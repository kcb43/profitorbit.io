# AI Description Generator Setup

The AI-powered description generator uses either OpenAI or Anthropic to generate product descriptions based on similar items in your inventory.

## Setup Instructions

### Option 1: OpenAI (Recommended)

1. Get an API key from [OpenAI](https://platform.openai.com/api-keys)
2. Add to your environment variables:
   ```bash
   OPENAI_API_KEY=your-api-key-here
   ```

### Option 2: Anthropic (Claude)

1. Get an API key from [Anthropic](https://console.anthropic.com/)
2. Add to your environment variables:
   ```bash
   ANTHROPIC_API_KEY=your-api-key-here
   ```

## How It Works

1. **Finds Similar Items**: The system searches your inventory for items with similar titles, brands, or categories
2. **Generates Descriptions**: Uses AI to analyze similar item descriptions and generate multiple unique variations
3. **Shuffle & Select**: Users can shuffle through generated descriptions and select the best one
4. **Customizable**: Users can then add personal details like condition, measurements, etc.

## Usage

1. Fill in the item title (required)
2. Optionally fill in brand, category, and condition
3. Click the "AI Generate" button next to the description field
4. Review generated descriptions and shuffle through options
5. Select a description to use or continue editing manually

## Cost Considerations

### Model Options (OpenAI)
- **gpt-4o-mini** (Current default): ~$0.15 per 1M input tokens, ~$0.60 per 1M output tokens
- **gpt-5o-nano** (Cheapest): ~$0.05 per 1M input tokens, ~$0.40 per 1M output tokens (5x cheaper!)
- **gpt-5o-mini**: ~$0.25 per 1M input tokens, ~$2.00 per 1M output tokens

**Recommendation**: Use `gpt-5o-nano` for description generation - it's 5x cheaper with minimal quality difference for simple product descriptions.

### Model Configuration
Set `OPENAI_MODEL` environment variable to use a different model:
```bash
OPENAI_MODEL=gpt-5o-nano  # Or gpt-4o-mini, gpt-5o-mini, etc.
```

### Anthropic Alternative
- Uses `claude-3-haiku-20240307` model (fast and cost-effective)

Both models are optimized for cost while maintaining quality. Each generation creates 5 description variations.

**Cost per 1,000 generations:**
- GPT-5 Nano: ~$0.85
- GPT-4o Mini: ~$1.50
- GPT-5 Mini: ~$4,250 (too expensive for this use case)

## Troubleshooting

If you see "AI API key not configured" error:
- Make sure you've set either `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` in your environment variables
- Restart your development server after adding the environment variable
- For production, add the key to your hosting platform's environment variables (Vercel, Netlify, etc.)

