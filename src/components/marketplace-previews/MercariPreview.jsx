import React from "react";

export function MercariPreview({ generalForm, marketplaceForm = {} }) {
  const title = marketplaceForm.title || generalForm?.title || "Item Title";
  const price = marketplaceForm.price || generalForm?.price || "0";
  const description = marketplaceForm.description || generalForm?.description || "";
  const brand = marketplaceForm.brand || generalForm?.brand || "";
  const condition = marketplaceForm.condition || generalForm?.condition || "";
  const category = marketplaceForm.mercariCategory || generalForm?.category || "";
  const photos = generalForm?.photos || [];
  const firstPhoto = typeof photos[0] === "string" ? photos[0] : photos[0]?.url || photos[0]?.imageUrl || null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden max-w-sm mx-auto shadow-sm">
      {/* Photo */}
      <div className="aspect-square bg-gray-100 relative">
        {firstPhoto ? (
          <img src={firstPhoto} alt={title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">No photo</div>
        )}
        {/* Photo count */}
        {photos.length > 1 && (
          <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full">
            1/{photos.length}
          </div>
        )}
      </div>

      {/* Details */}
      <div className="p-4 space-y-3">
        {/* Price */}
        <div className="text-2xl font-bold text-[#EB5757]">
          ${Number(price || 0).toFixed(0)}
        </div>

        {/* Title */}
        <h3 className="text-base font-semibold text-gray-900 leading-snug">
          {title}
        </h3>

        {/* Shipping info */}
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8" />
          </svg>
          <span>Free shipping</span>
        </div>

        {/* Condition + Brand */}
        <div className="flex flex-wrap gap-2">
          {condition && (
            <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700 border border-gray-200">
              {condition}
            </span>
          )}
          {brand && brand !== "Unbranded" && (
            <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700 border border-gray-200">
              {brand}
            </span>
          )}
          {category && (
            <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700 border border-gray-200">
              {category}
            </span>
          )}
        </div>

        {/* Description */}
        {description && (
          <p className="text-sm text-gray-600 line-clamp-4 leading-relaxed">
            {description}
          </p>
        )}

        {/* Mock action button */}
        <button className="w-full py-2.5 rounded-lg bg-[#EB5757] text-white font-semibold text-sm pointer-events-none">
          Buy Now
        </button>
      </div>
    </div>
  );
}
