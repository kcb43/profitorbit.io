import React from "react";

export function EbayPreview({ generalForm, marketplaceForm = {} }) {
  const title = marketplaceForm.title || generalForm?.title || "Item Title";
  const price = marketplaceForm.price || generalForm?.price || "0";
  const description = marketplaceForm.description || generalForm?.description || "";
  const brand = marketplaceForm.brand || generalForm?.brand || "";
  const condition = marketplaceForm.condition || generalForm?.condition || "";
  const category = marketplaceForm.categoryName || marketplaceForm.category || generalForm?.category || "";
  const photos = generalForm?.photos || [];
  const firstPhoto = typeof photos[0] === "string" ? photos[0] : photos[0]?.url || photos[0]?.imageUrl || null;

  const specifics = [
    { label: "Condition", value: condition },
    { label: "Brand", value: brand && brand !== "Unbranded" ? brand : null },
    { label: "Category", value: category },
  ].filter(s => s.value);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden max-w-sm mx-auto shadow-sm">
      {/* Photo */}
      <div className="aspect-square bg-gray-100 relative">
        {firstPhoto ? (
          <img src={firstPhoto} alt={title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">No photo</div>
        )}
        {photos.length > 1 && (
          <div className="absolute bottom-2 left-2 flex gap-1">
            {photos.slice(0, 5).map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full ${i === 0 ? "bg-[#3665F3]" : "bg-white/70 border border-gray-300"}`}
              />
            ))}
            {photos.length > 5 && (
              <span className="text-[9px] text-white bg-black/50 px-1 rounded">+{photos.length - 5}</span>
            )}
          </div>
        )}
      </div>

      {/* Details */}
      <div className="p-4 space-y-3">
        {/* Title */}
        <h3 className="text-base font-medium text-[#3665F3] leading-snug">
          {title}
        </h3>

        {/* Price */}
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-bold text-gray-900">
            ${Number(price || 0).toFixed(2)}
          </span>
          <span className="text-xs text-gray-500 font-medium">Buy It Now</span>
        </div>

        {/* Condition */}
        {condition && (
          <div className="text-xs text-gray-600">
            <span className="font-medium">Condition:</span> {condition}
          </div>
        )}

        {/* Shipping */}
        <div className="flex items-center gap-1.5 text-xs text-green-700 font-medium">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="M5 13l4 4L19 7" />
          </svg>
          Free shipping
        </div>

        {/* Item specifics */}
        {specifics.length > 0 && (
          <div className="border-t pt-2 mt-2">
            <div className="text-xs font-semibold text-gray-700 mb-1.5">Item specifics</div>
            <div className="space-y-1">
              {specifics.map(({ label, value }) => (
                <div key={label} className="flex text-xs">
                  <span className="text-gray-500 w-20 shrink-0">{label}</span>
                  <span className="text-gray-800 font-medium">{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Description */}
        {description && (
          <p className="text-sm text-gray-600 line-clamp-3 leading-relaxed border-t pt-2">
            {description}
          </p>
        )}

        {/* Mock action button */}
        <button className="w-full py-2.5 rounded-full bg-[#3665F3] text-white font-semibold text-sm pointer-events-none">
          Buy It Now
        </button>
      </div>
    </div>
  );
}
