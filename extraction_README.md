# Thematic Extraction Record

Story: The Magic Casket  
Author: R. Austin Freeman  
Model: Claude (Anthropic), claude.ai chat  
Extraction date: 05 November 2026

Files:
- Prompt: full_prompt.txt
- Original LLM output: llm_output.json
- Verified output: verified_items.json
- Theme dictionary: Theme_JSON.py
- Removed-phrase audit: removed_phrases.csv

Verification checks:
- Exact phrase occurrence after Unicode/case/whitespace normalization.
- Whole-phrase boundaries.
- Duplicate phrase removal across categories.
- Researcher rejection list applied.

Limitation: textual occurrence does not prove semantic fit. Review each phrase
in context and confirm its thematic subtype before interpreting counts.

Stoplist for later matching: ['at present']
