"""
Evaluation Report Generator

Auto-generates comprehensive evaluation reports in markdown format.
Inspired by NanoChat's report system (nanochat/report.py).

Report Sections:
1. Executive Summary (overall scores)
2. Model Comparison Table (v1 → v4.2 → v4.3)
3. Task-by-Task Breakdown (pricing, knowledge, BUY/PASS, predictions)
4. BPB Metrics (vocabulary-independent loss)
5. Detailed Statistics
6. Recommendations

Output: EVALUATION_REPORT.md
"""

import json
import datetime
import subprocess
from pathlib import Path
from typing import Dict, Any, List, Optional


class ReportGenerator:
    """
    Generate comprehensive evaluation reports.

    Combines results from:
    - Categorical tasks (pricing, knowledge, BUY/PASS)
    - Generative tasks (market predictions)
    - BPB calculations
    - Model metadata
    """

    def __init__(self, output_dir: str = "apps/mew1a/evaluation/reports"):
        """
        Initialize report generator.

        Args:
            output_dir: Directory to save reports
        """
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def generate_report(
        self,
        model_results: List[Dict[str, Any]],
        output_file: str = "EVALUATION_REPORT.md"
    ) -> str:
        """
        Generate evaluation report comparing multiple models.

        Args:
            model_results: List of results dicts, one per model
                Each dict should contain:
                {
                    'model_name': str - Model identifier
                    'model_version': str - Version (v1, v4.2, v4.3, etc.)
                    'pricing_accuracy': Dict - Results from PricingAccuracyTask
                    'card_knowledge': Dict - Results from CardKnowledgeTask
                    'buy_pass': Dict - Results from BuyPassTask
                    'market_prediction': Dict - Results from MarketPredictionTask
                    'bpb': Dict - Results from BPBCalculator
                    'timestamp': str - Evaluation timestamp
                }
            output_file: Output filename

        Returns:
            Path to generated report
        """
        output_path = self.output_dir / output_file

        # Build report sections
        sections = []

        sections.append(self._generate_header())
        sections.append(self._generate_executive_summary(model_results))
        sections.append(self._generate_comparison_table(model_results))
        sections.append(self._generate_task_breakdown(model_results))
        sections.append(self._generate_bpb_section(model_results))
        sections.append(self._generate_recommendations(model_results))
        sections.append(self._generate_metadata(model_results))

        # Combine sections
        report_content = "\n\n".join(sections)

        # Write to file
        with open(output_path, 'w') as f:
            f.write(report_content)

        print(f"\n✅ Report generated: {output_path}")

        return str(output_path)

    def _generate_header(self) -> str:
        """Generate report header."""
        now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        return f"""# Mew-1A Evaluation Report

**Generated**: {now}
**Framework**: NanoChat-Inspired Evaluation System
**Purpose**: Measure Pokemon TCG LLM quality before production deployment

---
"""

    def _generate_executive_summary(self, model_results: List[Dict[str, Any]]) -> str:
        """Generate executive summary with key metrics."""
        lines = ["## Executive Summary\n"]

        for result in model_results:
            version = result['model_version']

            # Extract key metrics
            pricing_acc = result.get('pricing_accuracy', {}).get('accuracy', 0.0)
            knowledge_acc = result.get('card_knowledge', {}).get('accuracy', 0.0)
            buypass_acc = result.get('buy_pass', {}).get('accuracy', 0.0)
            prediction_score = result.get('market_prediction', {}).get('avg_score', 0.0)
            bpb = result.get('bpb', {}).get('bpb', 0.0)

            # Overall score (weighted average)
            overall_score = (
                pricing_acc * 0.30 +
                knowledge_acc * 0.25 +
                buypass_acc * 0.30 +
                prediction_score * 0.15
            )

            lines.append(f"### {version}\n")
            lines.append(f"- **Overall Score**: {overall_score:.3f} (0.0-1.0)")
            lines.append(f"- **Pricing Accuracy**: {pricing_acc:.3f}")
            lines.append(f"- **Card Knowledge**: {knowledge_acc:.3f}")
            lines.append(f"- **BUY/PASS Quality**: {buypass_acc:.3f}")
            lines.append(f"- **Market Predictions**: {prediction_score:.3f}")
            lines.append(f"- **BPB (lower=better)**: {bpb:.4f}")
            lines.append("")

        return "\n".join(lines)

    def _generate_comparison_table(self, model_results: List[Dict[str, Any]]) -> str:
        """Generate comparison table across models."""
        lines = ["## Model Comparison\n"]
        lines.append("| Metric | " + " | ".join([r['model_version'] for r in model_results]) + " |")
        lines.append("|--------|" + "|".join(["--------"] * len(model_results)) + "|")

        # Metrics to compare
        metrics = [
            ('Pricing Accuracy', 'pricing_accuracy', 'accuracy'),
            ('Card Knowledge', 'card_knowledge', 'accuracy'),
            ('BUY/PASS Quality', 'buy_pass', 'accuracy'),
            ('Market Predictions', 'market_prediction', 'avg_score'),
            ('BPB (Loss)', 'bpb', 'bpb'),
        ]

        for metric_name, task_key, result_key in metrics:
            values = []
            for result in model_results:
                value = result.get(task_key, {}).get(result_key, 0.0)
                if metric_name == 'BPB (Loss)':
                    values.append(f"{value:.4f}")
                else:
                    values.append(f"{value:.3f}")

            line = f"| {metric_name} | " + " | ".join(values) + " |"
            lines.append(line)

        lines.append("")
        return "\n".join(lines)

    def _generate_task_breakdown(self, model_results: List[Dict[str, Any]]) -> str:
        """Generate detailed breakdown for each task."""
        lines = ["## Task-by-Task Breakdown\n"]

        for result in model_results:
            version = result['model_version']
            lines.append(f"### {version}\n")

            # Pricing Accuracy
            if 'pricing_accuracy' in result:
                pricing = result['pricing_accuracy']
                lines.append(f"**Pricing Accuracy**:")
                lines.append(f"- Overall: {pricing.get('accuracy', 0.0):.3f}")

                # Calculate tolerance bands from predictions
                predictions = pricing.get('predictions', [])
                if predictions:
                    passes_5pct = sum(1 for p in predictions if p.get('passes_5pct')) / len(predictions)
                    passes_10pct = sum(1 for p in predictions if p.get('passes_10pct')) / len(predictions)
                    passes_15pct = sum(1 for p in predictions if p.get('passes_15pct')) / len(predictions)

                    lines.append(f"- ±5% tolerance: {passes_5pct:.3f}")
                    lines.append(f"- ±10% tolerance: {passes_10pct:.3f}")
                    lines.append(f"- ±15% tolerance: {passes_15pct:.3f}")
                lines.append("")

            # Card Knowledge
            if 'card_knowledge' in result:
                knowledge = result['card_knowledge']
                lines.append(f"**Card Knowledge**:")
                lines.append(f"- Overall: {knowledge.get('accuracy', 0.0):.3f}")

                # Break down by question type
                predictions = knowledge.get('predictions', [])
                if predictions:
                    question_types = {}
                    for p in predictions:
                        qtype = p.get('question_type', 'unknown')
                        if qtype not in question_types:
                            question_types[qtype] = {'correct': 0, 'total': 0}
                        question_types[qtype]['total'] += 1
                        if p.get('correct'):
                            question_types[qtype]['correct'] += 1

                    for qtype, stats in question_types.items():
                        acc = stats['correct'] / stats['total']
                        lines.append(f"- {qtype}: {acc:.3f}")
                lines.append("")

            # BUY/PASS
            if 'buy_pass' in result:
                buypass = result['buy_pass']
                lines.append(f"**BUY/PASS Decisions**:")
                lines.append(f"- Overall: {buypass.get('accuracy', 0.0):.3f}")

                # Break down by scenario type
                predictions = buypass.get('predictions', [])
                if predictions:
                    scenario_types = {}
                    for p in predictions:
                        stype = p.get('scenario_type', 'unknown')
                        if stype not in scenario_types:
                            scenario_types[stype] = {'correct': 0, 'total': 0}
                        scenario_types[stype]['total'] += 1
                        if p.get('correct'):
                            scenario_types[stype]['correct'] += 1

                    for stype, stats in scenario_types.items():
                        acc = stats['correct'] / stats['total']
                        lines.append(f"- {stype}: {acc:.3f}")
                lines.append("")

            # Market Predictions
            if 'market_prediction' in result:
                prediction = result['market_prediction']
                lines.append(f"**Market Predictions**:")
                lines.append(f"- Overall Score: {prediction.get('avg_score', 0.0):.3f}")
                lines.append(f"- Direction Accuracy: {prediction.get('accuracy', 0.0):.3f}")

                # Magnitude accuracy
                predictions = prediction.get('predictions', [])
                if predictions:
                    magnitude_scores = [p.get('magnitude_score', 0.0) for p in predictions if p.get('magnitude_score') is not None]
                    if magnitude_scores:
                        avg_magnitude = sum(magnitude_scores) / len(magnitude_scores)
                        lines.append(f"- Magnitude Accuracy: {avg_magnitude:.3f}")
                lines.append("")

            lines.append("---\n")

        return "\n".join(lines)

    def _generate_bpb_section(self, model_results: List[Dict[str, Any]]) -> str:
        """Generate BPB comparison section."""
        lines = ["## Bits Per Byte (BPB) Analysis\n"]
        lines.append("**Lower is better** - Measures compression efficiency.\n")

        for result in model_results:
            version = result['model_version']

            if 'bpb' in result:
                bpb_data = result['bpb']
                lines.append(f"### {version}")
                lines.append(f"- **BPB**: {bpb_data.get('bpb', 0.0):.4f}")
                lines.append(f"- Total Nats: {bpb_data.get('total_nats', 0.0):.2f}")
                lines.append(f"- Total Bytes: {bpb_data.get('total_bytes', 0)}")
                lines.append(f"- Total Tokens: {bpb_data.get('num_tokens', 0)}")
                lines.append("")

        return "\n".join(lines)

    def _generate_recommendations(self, model_results: List[Dict[str, Any]]) -> str:
        """Generate deployment recommendations."""
        lines = ["## Recommendations\n"]

        # Find best model by overall score
        best_model = None
        best_score = -1.0

        for result in model_results:
            pricing_acc = result.get('pricing_accuracy', {}).get('accuracy', 0.0)
            knowledge_acc = result.get('card_knowledge', {}).get('accuracy', 0.0)
            buypass_acc = result.get('buy_pass', {}).get('accuracy', 0.0)
            prediction_score = result.get('market_prediction', {}).get('avg_score', 0.0)

            overall_score = (
                pricing_acc * 0.30 +
                knowledge_acc * 0.25 +
                buypass_acc * 0.30 +
                prediction_score * 0.15
            )

            if overall_score > best_score:
                best_score = overall_score
                best_model = result['model_version']

        lines.append(f"**Best Model**: {best_model} (score: {best_score:.3f})\n")

        # Quality thresholds
        if best_score >= 0.85:
            lines.append("✅ **Ready for Production** - All metrics exceed quality gates.")
        elif best_score >= 0.75:
            lines.append("⚠️ **Ready with Monitoring** - Deploy with close monitoring.")
        else:
            lines.append("❌ **Not Ready** - Requires further training or data improvements.")

        lines.append("")

        # Specific recommendations
        lines.append("### Specific Recommendations:\n")

        # Check pricing accuracy
        best_result = next(r for r in model_results if r['model_version'] == best_model)
        pricing_acc = best_result.get('pricing_accuracy', {}).get('accuracy', 0.0)

        if pricing_acc < 0.75:
            lines.append("- ⚠️ **Pricing accuracy low** - Review pricing dataset quality")

        buypass_acc = best_result.get('buy_pass', {}).get('accuracy', 0.0)
        if buypass_acc < 0.80:
            lines.append("- ⚠️ **BUY/PASS accuracy low** - Review decision training data")

        bpb = best_result.get('bpb', {}).get('bpb', 0.0)
        if bpb > 1.0:
            lines.append("- ⚠️ **High BPB** - Model may be undertrained")

        return "\n".join(lines)

    def _generate_metadata(self, model_results: List[Dict[str, Any]]) -> str:
        """Generate metadata section."""
        lines = ["## Metadata\n"]

        for result in model_results:
            version = result['model_version']
            lines.append(f"### {version}")
            lines.append(f"- Model Name: `{result.get('model_name', 'N/A')}`")
            lines.append(f"- Timestamp: {result.get('timestamp', 'N/A')}")

            # Git info (if available)
            try:
                git_hash = subprocess.check_output(['git', 'rev-parse', 'HEAD']).decode('utf-8').strip()[:8]
                lines.append(f"- Git Hash: `{git_hash}`")
            except:
                pass

            lines.append("")

        return "\n".join(lines)


# Example usage:
if __name__ == "__main__":
    # Generate example report
    generator = ReportGenerator()

    # Mock results for demonstration
    model_results = [
        {
            'model_version': 'v4.2',
            'model_name': 'ChicoPanama/mew1a-llama-3.2-3b-tcg-pricing',
            'pricing_accuracy': {'accuracy': 0.78},
            'card_knowledge': {'accuracy': 0.82},
            'buy_pass': {'accuracy': 0.85},
            'market_prediction': {'avg_score': 0.71, 'accuracy': 0.68},
            'bpb': {'bpb': 0.95, 'total_nats': 1250.5, 'total_bytes': 18500, 'num_tokens': 4200},
            'timestamp': '2025-10-22 14:30:00'
        },
        {
            'model_version': 'v4.3',
            'model_name': 'ChicoPanama/mew1a-v4.3-llama-3.2-3b-pokemon-tcg',
            'pricing_accuracy': {'accuracy': 0.82},
            'card_knowledge': {'accuracy': 0.85},
            'buy_pass': {'accuracy': 0.88},
            'market_prediction': {'avg_score': 0.75, 'accuracy': 0.72},
            'bpb': {'bpb': 0.92, 'total_nats': 1180.2, 'total_bytes': 18500, 'num_tokens': 4200},
            'timestamp': '2025-10-23 10:15:00'
        }
    ]

    report_path = generator.generate_report(model_results)
    print(f"Example report generated: {report_path}")
