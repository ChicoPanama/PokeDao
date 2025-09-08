import sys
import os
import json

# Add ml directory to path
sys.path.append('./ml')

try:
    from normalize import CardNormalizer
    
    # Test with sample titles
    test_titles = [
        "Charizard (4/102) [Base Set] Holo Rare",
        "Pokemon - Pikachu - 58/102 - Base Set - Common", 
        "Dark Charizard Holo #4 Team Rocket PSA 10",
        "Lugia Neo Genesis 9/111 Holo First Edition"
    ]
    
    normalizer = CardNormalizer()
    results = []
    
    for title in test_titles:
        try:
            result = normalizer.normalize_card_title(title)
            results.append({
                'title': title,
                'success': True,
                'card_key': result.card_key,
                'confidence': round(result.confidence, 2),
                'pokemon': result.name,
                'set': result.set_code,
                'number': result.number
            })
        except Exception as e:
            results.append({
                'title': title,
                'success': False,
                'error': str(e)
            })
    
    print(json.dumps({
        'status': 'success',
        'results': results,
        'summary': {
            'total': len(test_titles),
            'successful': len([r for r in results if r['success']]),
            'failed': len([r for r in results if not r['success']])
        }
    }, indent=2))
    
except ImportError as e:
    print(json.dumps({
        'status': 'import_error',
        'error': str(e),
        'message': 'Normalization engine import failed'
    }))
    
except Exception as e:
    print(json.dumps({
        'status': 'error', 
        'error': str(e),
        'message': 'Unexpected error in normalization engine'
    }))
