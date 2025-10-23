"""
Mew-1A Evaluation Framework

Comprehensive evaluation system for measuring Pokemon TCG LLM quality.
Inspired by NanoChat's evaluation architecture.

Quick Start:
    from mew1a.evaluation import (
        PricingAccuracyTask,
        CardKnowledgeTask,
        BuyPassTask,
        MarketPredictionTask,
        CategoricalEvaluator,
        GenerativeEvaluator,
        BPBCalculator,
        ReportGenerator
    )

    # Evaluate categorical tasks (fast)
    pricing_task = PricingAccuracyTask()
    evaluator = CategoricalEvaluator(model_name="ChicoPanama/mew1a-v4.3")
    results = evaluator.evaluate_task(pricing_task)

    # Evaluate generative tasks (slower)
    prediction_task = MarketPredictionTask()
    gen_evaluator = GenerativeEvaluator(model_name="ChicoPanama/mew1a-v4.3")
    pred_results = gen_evaluator.evaluate_task(prediction_task)

    # Generate report
    report_gen = ReportGenerator()
    report_gen.generate_report([results, pred_results])
"""

from .task_base import Task, TaskMixture
from .pricing_accuracy import PricingAccuracyTask
from .card_knowledge import CardKnowledgeTask
from .buy_pass_task import BuyPassTask
from .market_prediction import MarketPredictionTask
from .categorical_evaluator import CategoricalEvaluator
from .generative_evaluator import GenerativeEvaluator
from .bpb_calculator import BPBCalculator
from .report_generator import ReportGenerator

__all__ = [
    # Base classes
    'Task',
    'TaskMixture',
    # Task implementations
    'PricingAccuracyTask',
    'CardKnowledgeTask',
    'BuyPassTask',
    'MarketPredictionTask',
    # Evaluators
    'CategoricalEvaluator',
    'GenerativeEvaluator',
    # Metrics
    'BPBCalculator',
    # Reporting
    'ReportGenerator',
]
