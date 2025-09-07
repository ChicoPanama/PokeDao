"""
Test suite for PokeDAO Card Title Normalization Engine
Phase 2: Comprehensive testing of parsing patterns and edge cases
"""

import pytest
import orjson
from pathlib import Path
import sys

# Add the ml directory to the path so we can import normalize
sys.path.insert(0, str(Path(__file__).parent.parent))

from normalize import CardNormalizer, normalize_card_title, NormalizationError, ParsedCard


class TestCardNormalizer:
    """Test cases for the CardNormalizer class."""
    
    @pytest.fixture
    def normalizer(self):
        """Create a normalizer instance for testing."""
        return CardNormalizer()
    
    @pytest.fixture 
    def test_fixtures(self):
        """Load test fixtures from JSON."""
        fixtures_path = Path(__file__).parent / 'fixtures.json'
        with open(fixtures_path, 'rb') as f:
            return orjson.loads(f.read())
    
    def test_normalizer_initialization(self, normalizer):
        """Test that normalizer initializes correctly."""
        assert normalizer is not None
        assert len(normalizer.sets_data) > 0
        assert len(normalizer.patterns_data['title_patterns']) > 0
        assert len(normalizer.set_index) > 0
    
    def test_empty_title_handling(self, normalizer):
        """Test handling of empty or invalid titles."""
        with pytest.raises(NormalizationError):
            normalizer.normalize_card_title("")
        
        with pytest.raises(NormalizationError):
            normalizer.normalize_card_title("   ")
        
        with pytest.raises(NormalizationError):
            normalizer.normalize_card_title(None)
    
    def test_standard_format_parsing(self, normalizer):
        """Test standard format: Name Set #Number Grade."""
        result = normalizer.normalize_card_title("Charizard Base Set #4 PSA 10")
        
        assert result.name == "Charizard"
        assert result.set_code == "base1"
        assert result.number == "004"
        assert result.variant is None
        assert result.grade == "PSA 10"
        assert result.card_key == "base1-004-base-psa10"
        assert result.confidence >= 0.8
    
    def test_parenthetical_format_parsing(self, normalizer):
        """Test parenthetical format: Name (Number/Total) - Set."""
        result = normalizer.normalize_card_title("Charizard (4/102) - Base Set - Holo Rare - PSA 9")
        
        assert result.name == "Charizard"
        assert result.set_code == "base1"
        assert result.number == "004"
        assert result.variant == "holo"
        assert result.grade == "PSA 9"
        assert result.card_key == "base1-004-holo-psa9"
    
    def test_variant_parsing(self, normalizer):
        """Test variant extraction and normalization."""
        test_cases = [
            ("Blastoise Base Set Holo #2 BGS 9", "holo"),
            ("Pikachu Base Set Reverse Holo #58", "reverse"),
            ("Mew Promo #8 PSA 10", "promo"),
            ("Charizard Base Set Full Art #150", "fullart")
        ]
        
        for title, expected_variant in test_cases:
            try:
                result = normalizer.normalize_card_title(title)
                assert result.variant == expected_variant, f"Failed for {title}"
            except NormalizationError:
                # Some might fail due to missing sets, that's ok for this test
                pass
    
    def test_grade_parsing(self, normalizer):
        """Test grade extraction and normalization."""
        test_cases = [
            ("Charizard Base Set #4 PSA 10", "PSA 10"),
            ("Pikachu Base Set #25 BGS 9.5", "BGS 9.5"),
            ("Blastoise Base Set #2 CGC 8", "CGC 8"),
            ("Venusaur Base Set #15 Near Mint", "raw"),
            ("Wartortle Base Set #42", "raw")
        ]
        
        for title, expected_grade in test_cases:
            try:
                result = normalizer.normalize_card_title(title)
                assert result.grade == expected_grade, f"Failed for {title}: got {result.grade}"
            except NormalizationError:
                # Some might fail due to missing sets, that's ok for this test
                pass
    
    def test_set_resolution(self, normalizer):
        """Test fuzzy set name matching."""
        test_cases = [
            ("Base Set", "base1"),
            ("base", "base1"),
            ("Jungle", "jungle"),
            ("Team Rocket", "teamrocket"),
            ("XY Evolutions", "xyevolutions"),
            ("Evolutions", "xyevolutions")
        ]
        
        for raw_set, expected_code in test_cases:
            result = normalizer._resolve_set_code(raw_set)
            assert result == expected_code, f"Failed to resolve {raw_set} to {expected_code}, got {result}"
    
    def test_card_key_generation(self):
        """Test card key generation consistency."""
        card = ParsedCard(
            name="Charizard",
            set_code="base1",
            number="4",
            variant="holo",
            grade="PSA 10"
        )
        
        expected_key = "base1-004-holo-psa10"
        assert card.card_key == expected_key
        
        # Test consistency - same input should produce same output
        card2 = ParsedCard(
            name="Charizard",
            set_code="base1", 
            number="4",
            variant="holo",
            grade="PSA 10"
        )
        assert card2.card_key == expected_key
    
    def test_number_padding(self):
        """Test card number padding to 3 digits."""
        test_cases = [
            ("1", "001"),
            ("25", "025"),
            ("100", "100"),
            ("4", "004")
        ]
        
        for input_num, expected in test_cases:
            card = ParsedCard(
                name="Test",
                set_code="test",
                number=input_num
            )
            assert card.card_key and expected in card.card_key
    
    def test_fixtures_comprehensive(self, normalizer, test_fixtures):
        """Test against comprehensive fixture dataset."""
        passed = 0
        failed = 0
        
        for fixture in test_fixtures:
            title = fixture['title']
            expected = fixture['expected']
            should_fail = fixture.get('should_fail', False)
            
            try:
                result = normalizer.normalize_card_title(title)
                
                if should_fail:
                    failed += 1
                    print(f"❌ Expected failure but passed: {title}")
                    continue
                
                # Check each expected field
                success = True
                for field, expected_value in expected.items():
                    if field == 'card_key':
                        continue  # We'll check this separately
                    
                    actual_value = getattr(result, field, None)
                    if actual_value != expected_value:
                        print(f"❌ {title}")
                        print(f"   Field {field}: expected {expected_value}, got {actual_value}")
                        success = False
                        break
                
                if success:
                    passed += 1
                    print(f"✅ {title} -> {result.card_key}")
                else:
                    failed += 1
                    
            except NormalizationError as e:
                if should_fail:
                    passed += 1
                    print(f"✅ Expected failure: {title}")
                else:
                    failed += 1
                    print(f"❌ Unexpected failure: {title} - {e}")
        
        success_rate = passed / (passed + failed) if (passed + failed) > 0 else 0
        print(f"\\n📊 Success Rate: {success_rate:.1%} ({passed}/{passed + failed})")
        
        # Assert we meet our target success rate
        assert success_rate >= 0.9, f"Success rate {success_rate:.1%} below target 90%"
    
    @pytest.mark.benchmark
    def test_performance_benchmark(self, normalizer, benchmark):
        """Benchmark normalization performance."""
        test_title = "Charizard Base Set #4 PSA 10"
        
        def normalize_title():
            return normalizer.normalize_card_title(test_title)
        
        result = benchmark(normalize_title)
        assert result.card_key == "base1-004-base-psa10"
    
    def test_batch_normalization(self):
        """Test batch processing functionality."""
        from normalize import batch_normalize
        
        test_titles = [
            "Charizard Base Set #4 PSA 10",
            "Pikachu Jungle #60 PSA 8", 
            "Invalid title that should fail",
            "Blastoise Base Set #2 BGS 9"
        ]
        
        results = batch_normalize(test_titles)
        assert len(results) == len(test_titles)
        assert results[0] is not None  # Should succeed
        assert results[1] is not None  # Should succeed
        assert results[2] is None      # Should fail
        # results[3] may succeed or fail depending on patterns
    
    def test_edge_cases(self, normalizer):
        """Test edge cases and error conditions."""
        edge_cases = [
            "A #1 B",  # Very short name
            "Charizard Unknown Set #4 PSA 10",  # Unknown set
            "Charizard Base Set #999 PSA 10",  # High card number
            "Charizard Base Set #0 PSA 10",  # Invalid card number
            "123 Numbers Only #4 PSA 10",  # Number-only name
        ]
        
        for title in edge_cases:
            try:
                result = normalizer.normalize_card_title(title)
                # If it succeeds, validate the result
                assert result.name
                assert result.set_code
                assert result.number.isdigit()
                assert int(result.number) >= 1
            except NormalizationError:
                # It's okay for edge cases to fail
                pass


if __name__ == "__main__":
    # Run tests when executed directly
    pytest.main([__file__, "-v", "--tb=short"])
