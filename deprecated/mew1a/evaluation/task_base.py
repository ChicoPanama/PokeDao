"""
Base class for all Pokemon TCG evaluation tasks.

Inspired by NanoChat's task system (tasks/common.py), adapted for Pokemon TCG domain.
Each task represents a specific capability we want to measure:
- Pricing accuracy
- Card knowledge
- BUY/PASS recommendation quality
- Market trend prediction
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional


class Task(ABC):
    """
    Base class for evaluation tasks.

    Each task provides:
    1. A dataset of test examples
    2. An evaluation method to score model outputs
    3. Metadata about the task type (categorical vs generative)
    """

    def __init__(self, start: int = 0, stop: Optional[int] = None, step: int = 1):
        """
        Initialize task with optional slicing (for lightweight views).

        Args:
            start: Start index (inclusive)
            stop: Stop index (exclusive), None = use full dataset
            step: Step size for slicing
        """
        assert start >= 0, f"Start must be non-negative, got {start}"
        assert stop is None or stop >= start, f"Stop {stop} must be >= start {start}"
        assert step >= 1, f"Step must be positive, got {step}"

        self.start = start
        self.stop = stop
        self.step = step

    @property
    @abstractmethod
    def eval_type(self) -> str:
        """
        Return evaluation type: 'generative' or 'categorical'.

        - 'categorical': Fast evaluation using logits only (e.g., BUY vs PASS)
        - 'generative': Full sampling required (e.g., price prediction)
        """
        raise NotImplementedError

    @property
    @abstractmethod
    def name(self) -> str:
        """Return human-readable task name."""
        raise NotImplementedError

    @abstractmethod
    def num_examples(self) -> int:
        """Return total number of examples in the underlying dataset."""
        raise NotImplementedError

    @abstractmethod
    def get_example(self, index: int) -> Dict[str, Any]:
        """
        Get a single test example.

        Args:
            index: Physical index in the dataset

        Returns:
            Dictionary with at minimum:
            - 'prompt': str - The input prompt for the model
            - 'target': Any - The ground truth answer
            - Other task-specific fields as needed
        """
        raise NotImplementedError

    @abstractmethod
    def evaluate(self, example: Dict[str, Any], model_output: str) -> Dict[str, Any]:
        """
        Evaluate model output against ground truth.

        Args:
            example: The test example (from get_example)
            model_output: The model's generated response

        Returns:
            Dictionary with at minimum:
            - 'correct': bool - Whether the answer was correct
            - 'score': float - Numeric score (0.0 to 1.0)
            - Other task-specific metrics
        """
        raise NotImplementedError

    def __len__(self) -> int:
        """Return length of the sliced view."""
        start = self.start
        stop = self.num_examples() if self.stop is None else self.stop
        step = self.step
        span = stop - start
        num = (span + step - 1) // step  # Ceiling division
        assert num >= 0, f"Negative number of examples: {num}"
        return num

    def __getitem__(self, index: int) -> Dict[str, Any]:
        """Get example by index (respecting slicing)."""
        assert isinstance(index, int), f"Index must be int, got {type(index)}"
        assert 0 <= index < len(self), f"Index {index} out of range [0, {len(self)})"

        # Convert logical index to physical index
        physical_index = self.start + index * self.step
        return self.get_example(physical_index)


class TaskMixture(Task):
    """
    Mix multiple tasks together for comprehensive evaluation.

    Example:
        mixture = TaskMixture([
            PricingAccuracyTask(),
            CardKnowledgeTask(),
            BuyPassTask()
        ])
    """

    def __init__(self, tasks: List[Task], **kwargs):
        super().__init__(**kwargs)
        self.tasks = tasks
        self.lengths = [len(task) for task in tasks]
        self.total_examples = sum(self.lengths)

        # Build index map: (task_idx, local_idx) for each example
        self.index_map = []
        for task_idx, task_length in enumerate(self.lengths):
            for local_idx in range(task_length):
                self.index_map.append((task_idx, local_idx))

    @property
    def eval_type(self) -> str:
        # Mixed type - must handle both
        return "mixed"

    @property
    def name(self) -> str:
        task_names = [task.name for task in self.tasks]
        return f"TaskMixture({', '.join(task_names)})"

    def num_examples(self) -> int:
        return self.total_examples

    def get_example(self, index: int) -> Dict[str, Any]:
        """Get example from the appropriate task."""
        assert 0 <= index < self.total_examples
        task_idx, local_idx = self.index_map[index]
        example = self.tasks[task_idx][local_idx]
        # Add task metadata
        example['task_name'] = self.tasks[task_idx].name
        example['task_eval_type'] = self.tasks[task_idx].eval_type
        return example

    def evaluate(self, example: Dict[str, Any], model_output: str) -> Dict[str, Any]:
        """Route evaluation to the appropriate task."""
        task_name = example['task_name']
        task = next(t for t in self.tasks if t.name == task_name)
        return task.evaluate(example, model_output)
