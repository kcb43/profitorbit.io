import React from "react";

export function FacebookPreview({ generalForm, marketplaceForm = {} }) {
  const title = marketplaceForm.title || generalForm?.title || "Item Title";
  const price = marketplaceForm.price || generalForm?.price || "0";
  const description = marketplaceForm.description || generalForm?.description || "";
  const condition = marketplaceForm.condition || generalForm?.condition || "";
  const category = marketplaceForm.category || generalForm?.category || "";
  const zip = generalForm?.zip || "";
  const photos = generalForm?.photos || [];
  const firstPhoto = typeof photos[0] === "string" ? photos[0] : photos[0]?.url || photos[0]?.imageUrl || null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden max-w-sm mx-auto shadow-sm">
      {/* Photo */}
      <div className="aspect-[4/3] bg-gray-100 relative">
        {firstPhoto ? (
          <img src={firstPhoto} alt={title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">No photo</div>
        )}
        {photos.length > 1 && (
          <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full">
            1/{photos.length}
          </div>
        )}
      </div>

      {/* Details */}
      <div className="p-4 space-y-2">
        {/* Price */}
        <div className="text-xl font-bold text-gray-900">
          ${Number(price || 0).toFixed(0)}
        </div>

        {/* Title */}
        <h3 className="text-base font-medium text-gray-900 leading-snug">
          {title}
        </h3>

        {/* Location + Category */}
        <div className="flex items-center gap-2 text-xs text-gray-500">
          {zip && (
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {zip}
            </span>
          )}
          {category && (
            <>
              <span className="text-gray-300">·</span>
              <span>{category}</span>
            </>
          )}
        </div>

        {/* Condition */}
        {condition && (
          <div className="text-xs text-gray-500">
            Condition: <span className="text-gray-700">{condition}</span>
          </div>
        )}

        {/* Description */}
        {description && (
          <p className="text-sm text-gray-600 line-clamp-3 leading-relaxed pt-1">
            {description}
          </p>
        )}

        {/* Mock action button */}
        <button className="w-full py-2.5 rounded-lg bg-[#1877F2] text-white font-semibold text-sm pointer-events-none mt-2">
          Message Seller
        </button>
      </div>
    </div>
  );
}
