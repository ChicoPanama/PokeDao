#!/usr/bin/env python3
"""
Instrumented /analyze endpoint patch for Mew-1A v4.3
Adds watchdog timeout, detailed trace logging, and error handling per directive.
"""

# This code will be integrated into vllm_deploy_vector_rag.py

ANALYZE_ENDPOINT_PATCH = '''
    @web_app.post("/analyze")
    async def analyze(data: dict):
        """
        Card analysis endpoint with full instrumentation and timeout protection.

        Implements:
        - 60s watchdog timeout for entire request
        - Detailed trace logging at each stage
        - Graceful error handling with diagnostics
        - RAG k capping (≤8), token capping (≤512)
        """
        import time
        import traceback
        import json
        import math
        import asyncio
        from fastapi.responses import JSONResponse

        async def _analyze_impl():
            t0 = time.time()
            log = {"stage": "analyze", "trace": []}

            def mark(step: str):
                """Record timing checkpoint"""
                log["trace"].append({
                    "step": step,
                    "elapsed_ms": round((time.time() - t0) * 1000, 1)
                })

            try:
                mark("start")

                # ============================================================
                # VALIDATION
                # ============================================================
                card_name = data.get("card_name", "").strip()
                set_name = data.get("set_name", "").strip()
                listed_price = data.get("listed_price")
                fair_value = data.get("fair_value")
                max_tokens = min(int(data.get("max_tokens", 200)), 512)  # Cap at 512
                use_rag = data.get("use_rag", True)

                if not card_name:
                    return JSONResponse(
                        status_code=400,
                        content={"error": "card_name required", "trace": log["trace"]}
                    )

                if listed_price is not None:
                    try:
                        listed_price = float(listed_price)
                        if not math.isfinite(listed_price):
                            raise ValueError("listed_price must be finite")
                    except (ValueError, TypeError) as e:
                        return JSONResponse(
                            status_code=400,
                            content={"error": f"Invalid listed_price: {e}", "trace": log["trace"]}
                        )

                if fair_value is not None:
                    try:
                        fair_value = float(fair_value)
                        if not math.isfinite(fair_value):
                            raise ValueError("fair_value must be finite")
                    except (ValueError, TypeError) as e:
                        return JSONResponse(
                            status_code=400,
                            content={"error": f"Invalid fair_value: {e}", "trace": log["trace"]}
                        )

                mark(f"validated card={card_name} set={set_name} price={listed_price} tfv={fair_value}")

                # ============================================================
                # RAG RETRIEVAL (with timeout and k cap)
                # ============================================================
                rag_context = []
                rag_cards_count = 0

                if use_rag:
                    try:
                        rag_start = time.time()
                        model = Mew1AV43VectorRAGModel()

                        # Cap RAG k at 8 to prevent slowdowns
                        k = min(data.get("k", 5), 8)

                        # Retrieve with 10s timeout
                        rag_result = await asyncio.wait_for(
                            asyncio.to_thread(
                                model.rag.search,
                                query=f"{card_name} {set_name}".strip(),
                                top_k=k
                            ),
                            timeout=10.0
                        )

                        rag_cards_count = len(rag_result)
                        rag_context = rag_result[:k]  # Ensure cap

                        mark(f"rag_retrieve k={rag_cards_count} dt={round(time.time()-rag_start,3)}s")

                    except asyncio.TimeoutError:
                        mark("rag_timeout_10s")
                        # Continue without RAG
                    except Exception as e:
                        mark(f"rag_error {type(e).__name__}: {str(e)[:100]}")
                        # Continue without RAG

                # ============================================================
                # PROMPT BUILD (with truncation)
                # ============================================================
                prompt_start = time.time()

                # Build analysis prompt
                if fair_value and listed_price:
                    try:
                        discount = ((fair_value - listed_price) / fair_value) * 100
                    except ZeroDivisionError:
                        discount = 0.0

                    instruction = f"Analyze: {card_name}"
                    if set_name:
                        instruction += f" - {set_name}"
                    instruction += f". Listed at ${listed_price:.2f}, fair value ${fair_value:.2f} ({discount:.1f}% discount)"
                else:
                    instruction = f"Analyze the market for {card_name}"
                    if set_name:
                        instruction += f" from {set_name}"

                # Add RAG context if available
                rag_context_str = ""
                if rag_context:
                    rag_context_str = "\\n\\nRelevant market data:\\n"
                    for i, card in enumerate(rag_context[:5], 1):  # Top 5 only
                        rag_context_str += f"{i}. {card.get('pokemon_name', 'Unknown')} - ${card.get('price', 0):.2f}\\n"

                prompt = f"""Below is an instruction that describes a task. Write a response that appropriately completes the request.

### Instruction:
{instruction}{rag_context_str}

### Response:
"""

                # Truncate to 12KB max (safety)
                if len(prompt) > 12000:
                    prompt = prompt[:12000]
                    mark(f"prompt_truncated to 12000 chars")

                mark(f"prompt_built chars={len(prompt)} dt={round(time.time()-prompt_start,3)}s")

                # ============================================================
                # LLM GENERATION (with timeout)
                # ============================================================
                gen_start = time.time()

                try:
                    result = await asyncio.wait_for(
                        asyncio.to_thread(
                            model.generate,
                            prompt=prompt,
                            max_tokens=max_tokens,
                            temperature=0.3,
                            use_rag=False  # Already added RAG context to prompt
                        ),
                        timeout=45.0  # 45s generation timeout
                    )

                    mark(f"llm_generate dt={round(time.time()-gen_start,3)}s tokens={result.get('tokens', 0)}")

                except asyncio.TimeoutError:
                    mark("llm_timeout_45s")
                    return JSONResponse(
                        status_code=504,
                        content={
                            "error": "LLM generation timeout (45s)",
                            "trace": log["trace"]
                        }
                    )

                # ============================================================
                # DECISION LOGIC
                # ============================================================
                decision_start = time.time()

                response_text = result.get("response", "")

                # Extract recommendation
                recommendation = "NEUTRAL"
                if "BUY" in response_text.upper() and "PASS" not in response_text.upper():
                    recommendation = "BUY"
                elif "PASS" in response_text.upper():
                    recommendation = "PASS"
                elif "HOLD" in response_text.upper():
                    recommendation = "HOLD"

                mark(f"decision={recommendation} dt={round(time.time()-decision_start,3)}s")
                mark(f"total_time={round(time.time()-t0,3)}s")

                # ============================================================
                # RETURN SUCCESS
                # ============================================================
                return {
                    "ok": True,
                    "card": card_name,
                    "set": set_name,
                    "analysis": response_text,
                    "recommendation": recommendation,
                    "tfv_estimate": fair_value,
                    "listed_price": listed_price,
                    "discount_pct": round(((fair_value - listed_price) / fair_value * 100), 2) if fair_value and listed_price else None,
                    "tokens": result.get("tokens", 0),
                    "inference_time": result.get("inference_time", 0),
                    "tokens_per_second": result.get("tokens_per_second", 0),
                    "rag_augmented": len(rag_context) > 0,
                    "rag_cards_count": rag_cards_count,
                    "trace": log["trace"]
                }

            except Exception as e:
                # Catch-all error handler
                log["error"] = f"{type(e).__name__}: {str(e)}"
                log["traceback"] = traceback.format_exc()[-2000:]  # Last 2KB of trace

                # Log to Modal stdout
                print(f"[ANALYZE_ERROR] {json.dumps(log, indent=2)}")

                return JSONResponse(
                    status_code=500,
                    content={
                        "error": "internal_error",
                        "error_type": type(e).__name__,
                        "message": str(e)[:200],
                        "trace": log["trace"]
                    }
                )

        # Apply 60s watchdog timeout to entire request
        try:
            return await asyncio.wait_for(_analyze_impl(), timeout=60.0)
        except asyncio.TimeoutError:
            return JSONResponse(
                status_code=504,
                content={
                    "error": "Request timeout (60s watchdog)",
                    "message": "The analyze endpoint exceeded 60 seconds total processing time"
                }
            )
'''

print("="*70)
print("ANALYZE ENDPOINT PATCH")
print("="*70)
print()
print("This instrumented code should replace the current /analyze endpoint")
print(f"in: apps/mew1a/vllm_deploy_vector_rag.py")
print()
print("Key improvements:")
print("  ✓ 60s watchdog timeout for entire request")
print("  ✓ 45s timeout for LLM generation")
print("  ✓ 10s timeout for RAG retrieval")
print("  ✓ Detailed trace logging at each stage")
print("  ✓ RAG k capped at 8, tokens capped at 512")
print("  ✓ Prompt truncation at 12KB")
print("  ✓ Graceful error handling with diagnostics")
print()
print("="*70)
print()
print(ANALYZE_ENDPOINT_PATCH)
