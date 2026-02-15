# SerpAPI Evaluation for BareRetail

## Executive Summary

**Recommendation**: ✅ **Proceed with SerpAPI** for production Google Shopping data.

## Pricing Analysis

### Production Plan: $150/month
- **15,000 searches/month** ($0.01 per search)
- **3,000 throughput/hour** (sufficient for most traffic)
- **U.S. Legal Shield** included
- **Best for**: Initial launch, MVP, up to 500 searches/day

### Big Data Plan: $275/month
- **30,000 searches/month** ($0.0092 per search)
- **6,000 throughput/hour** (2x production capacity)
- **U.S. Legal Shield** included
- **Best for**: Growth phase, 1,000 searches/day

## Advantages Over RapidAPI

### 1. **Authentic Google Shopping Data**
- Real Google Shopping results (not aggregated/synthetic)
- Accurate pricing, availability, merchant info
- Rich product metadata (ratings, reviews, images)

### 2. **Data Quality**
From the sample JSON response (`nike shoes` search):

```json
{
  "immersive_products": [
    {
      "title": "Nike Men's Dunk Low Retro",
      "price": "$119.99",
      "extracted_price": 119.99,
      "rating": 4.7,
      "reviews": 5800,
      "merchant": "DICK'S Sporting Goods",
      "location": "Nearby, 14 mi",
      "extensions": ["360"],
      "image_url": "..."
    }
  ]
}
```

**Key data points available**:
- ✅ Accurate prices (extracted as numbers)
- ✅ Product ratings & review counts
- ✅ Merchant information
- ✅ Store locations ("Nearby, 14 mi")
- ✅ Product images (high quality)
- ✅ Shipping info (Free delivery)
- ✅ Special features (360° view, discounts)

### 3. **Performance**
- **Response time**: ~2 seconds (from `total_time_taken: 1.06`)
- **Acceptable**: Works well with aggressive pre-fetching
- **Caching**: Can cache results for 5-10 minutes

### 4. **Legal Protection**
- U.S. Legal Shield included in both plans
- Legitimate scraping with legal backing
- Less risk than DIY scraping

### 5. **Simple Integration**
```javascript
const params = new URLSearchParams({
  q: 'nike shoes',
  location: 'Austin, Texas, United States',
  hl: 'en',
  gl: 'us',
  google_domain: 'google.com'
});

const response = await fetch(`https://serpapi.com/search.json?${params}`, {
  headers: { 'X-API-KEY': SERPAPI_KEY }
});
```

## Cost Comparison

### Current Scale (500 searches/day)
- **Monthly**: 15,000 searches
- **Cost**: $150/month
- **Per search**: $0.01
- **Verdict**: ✅ Affordable for MVP

### Growth Scale (1,000 searches/day)
- **Monthly**: 30,000 searches
- **Cost**: $275/month
- **Per search**: $0.0092
- **Verdict**: ✅ Reasonable for scale

### High Traffic (2,000 searches/day)
- **Monthly**: 60,000 searches
- **Cost**: Custom pricing (likely $500-600/month)
- **Per search**: ~$0.008-0.01
- **Verdict**: ⚠️ Need to negotiate at this scale

## Implementation Plan

### Phase 1: Backend Integration (Orben API)
```javascript
// orben-api/functions/v1/search/index.js

async function fetchSerpAPI(query, location, limit = 10) {
  const params = new URLSearchParams({
    q: query,
    location: location || 'United States',
    hl: 'en',
    gl: 'us',
    google_domain: 'google.com',
    num: limit.toString()
  });

  const response = await fetch(
    `https://serpapi.com/search.json?${params}`,
    {
      headers: { 'X-API-KEY': process.env.SERPAPI_KEY }
    }
  );

  const data = await response.json();
  
  // Transform to our standard format
  return {
    items: data.immersive_products?.map(product => ({
      title: product.title,
      price: product.extracted_price,
      currency: 'USD',
      image_url: product.thumbnail,
      url: product.link,
      merchant: product.source,
      rating: product.rating,
      reviews: product.reviews,
      condition: 'New',
      shipping: product.delivery === 'Free delivery' ? 0 : null,
      location: product.location
    })) || []
  };
}
```

### Phase 2: Frontend (No Changes Needed!)
Your existing aggressive pre-fetching already handles caching and performance optimization. The frontend just calls the Orben API - it doesn't care about the underlying provider.

### Phase 3: Monitoring
Track these metrics:
- **Search volume**: Daily/monthly search counts
- **Response times**: Track SerpAPI latency
- **Cache hit rate**: How often pre-fetch helps
- **Cost per search**: Monitor against budget

## Risk Mitigation

### 1. **API Key Security**
- Store `SERPAPI_KEY` in Netlify environment variables
- Never expose in frontend code
- Use Orben API as proxy

### 2. **Rate Limiting**
- Production: 3,000 searches/hour = 50/minute
- Implement backend rate limiting to prevent abuse
- Show user-friendly error if limit exceeded

### 3. **Fallback Strategy**
If SerpAPI fails:
1. Try cached results first
2. Show user error message
3. Allow retry with exponential backoff

### 4. **Cost Control**
- Set up billing alerts at 10k, 13k, 15k searches
- Implement usage dashboard for admins
- Consider rate limiting per user if needed

## Migration Steps

1. **Sign up for SerpAPI** (Production plan)
2. **Add API key** to Netlify environment: `SERPAPI_KEY`
3. **Update Orben API** to use SerpAPI provider
4. **Test thoroughly** with sample queries
5. **Monitor costs** for first week
6. **Optimize caching** based on usage patterns

## Alternatives Considered

| Provider | Pros | Cons | Verdict |
|----------|------|------|---------|
| **SerpAPI** | Real Google data, legal shield, good pricing | ~2s latency | ✅ **Recommended** |
| **RapidAPI** | Cheaper? | Unclear data source, reliability issues | ❌ Not recommended |
| **ScraperAPI** | Flexible scraping | Need custom parser, legal gray area | ⚠️ More complex |
| **Google Shopping API** | Official | Requires merchant account, limited | ❌ Not suitable |

## Next Steps

1. ✅ Sign up for SerpAPI Production plan ($150/month)
2. ✅ Get API key from dashboard
3. ✅ Add to Netlify: `SERPAPI_KEY=your_key_here`
4. ✅ Update Orben API backend code
5. ✅ Test with "nike shoes", "iPhone 15", "PS5"
6. ✅ Monitor performance and costs
7. ✅ Launch to production

## Budget Forecast

| Month | Estimated Searches | Plan | Cost |
|-------|-------------------|------|------|
| Month 1-2 | 10,000-15,000 | Production | $150 |
| Month 3-4 | 20,000-30,000 | Big Data | $275 |
| Month 5+ | 40,000+ | Custom | ~$400-500 |

## Conclusion

**SerpAPI is the right choice** for BareRetail because:

1. ✅ **Data Quality**: Real Google Shopping results
2. ✅ **Performance**: 2-second response times work with pre-fetching
3. ✅ **Cost**: $150/month is reasonable for MVP
4. ✅ **Legal**: U.S. Legal Shield provides protection
5. ✅ **Integration**: Simple REST API, easy backend changes
6. ✅ **Scalability**: Clear pricing tiers for growth

**Proceed with confidence!**

---

**Version**: 1.0
**Date**: 2026-02-14
**Status**: ✅ Recommended for Implementation
