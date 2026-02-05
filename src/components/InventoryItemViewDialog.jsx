import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format, parseISO } from 'date-fns';
import { DollarSign, Calendar, Package, Tag, Edit as EditIcon, Star, ChevronDown, ChevronUp } from 'lucide-react';
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ImageCarousel } from "@/components/ImageCarousel";
import { OptimizedImage } from "@/components/OptimizedImage";

const DEFAULT_IMAGE_URL = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68e86fb5ac26f8511acce7ec/4abea2f77_box.png";

const statusColors = {
  available: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 hover:dark:bg-blue-900/30",
  listed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800 hover:bg-green-100 hover:dark:bg-green-900/30",
  sold: "bg-gray-100 text-gray-800 dark:bg-card dark:text-gray-400 border border-gray-200 dark:border-border hover:bg-gray-100 hover:dark:bg-card",
};

const statusLabels = {
  available: "Available",
  listed: "Listed",
  sold: "Sold",
};

export function InventoryItemViewDialog({ item, isOpen, onClose, tags = [], isFavorite = false }) {
  const navigate = useNavigate();
  const [notesExpanded, setNotesExpanded] = useState(false);
  
  if (!item) return null;

  const perItemPrice = item.purchase_price / (item.quantity > 0 ? item.quantity : 1);
  const quantitySold = item.quantity_sold || 0;
  const availableToSell = item.quantity - quantitySold;
  const isSoldOut = quantitySold >= item.quantity;
  
  // Notes truncation for desktop (show first 150 characters)
  const NOTES_TRUNCATE_LENGTH = 150;
  const notesText = item.notes || '';
  const shouldTruncateNotes = notesText.length > NOTES_TRUNCATE_LENGTH;
  const displayNotes = shouldTruncateNotes && !notesExpanded 
    ? notesText.substring(0, NOTES_TRUNCATE_LENGTH) + '...'
    : notesText;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto p-0">
        <div className="flex flex-col md:grid md:grid-cols-2">
          {/* Image Section */}
          <div className="order-1 md:order-2 min-h-[340px] md:min-h-0">
            {item.images && item.images.length > 1 ? (
              <div className="w-full h-[340px] md:h-full">
                <ImageCarousel
                  images={item.images}
                  className="w-full h-full"
                  imageClassName="object-cover md:rounded-r-lg w-full h-full"
                  counterPosition="bottom"
                />
              </div>
            ) : (
              <OptimizedImage
                src={item.image_url || DEFAULT_IMAGE_URL}
                alt={item.item_name}
                fallback={DEFAULT_IMAGE_URL}
                className="w-full h-[340px] md:h-full object-cover md:rounded-r-lg"
              />
            )}
          </div>

          {/* Details Section */}
          <div className="p-4 md:p-6 order-2 md:order-1">
            <DialogHeader className="mb-4">
              <div className="flex items-start justify-between gap-2">
                <DialogTitle className="text-lg font-bold pr-6 break-words">{item.item_name}</DialogTitle>
                {isFavorite && <Star className="w-5 h-5 text-amber-500 fill-current flex-shrink-0" />}
              </div>
              <Badge className={statusColors[item.status]}>
                {statusLabels[item.status]}
              </Badge>
            </DialogHeader>

            <div className="space-y-3 text-sm">
              {/* Edit Button - Mobile first */}
              <div className="md:hidden">
                <Button
                  onClick={() => {
                    onClose();
                    navigate(createPageUrl(`AddInventoryItem?id=${item.id}`));
                  }}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <EditIcon className="w-4 h-4 mr-2" />
                  Edit Item
                </Button>
              </div>

              {/* Purchase Price */}
              <div className="flex justify-between items-center p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                <span className="font-medium flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  Purchase Price
                </span>
                <span className="font-bold text-lg text-blue-600 dark:text-blue-400">
                  ${item.purchase_price.toFixed(2)}
                </span>
              </div>

              {/* Quantity Info */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Quantity</p>
                  <p className="font-semibold">{item.quantity}</p>
                  {item.quantity > 1 && (
                    <p className="text-xs text-gray-400">${perItemPrice.toFixed(2)} each</p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Available</p>
                  <p className={`font-semibold ${isSoldOut ? 'text-red-600' : 'text-green-600'}`}>
                    {isSoldOut ? 'Sold Out' : availableToSell}
                  </p>
                  {quantitySold > 0 && (
                    <p className="text-xs text-gray-400">{quantitySold} sold</p>
                  )}
                </div>
              </div>

              {/* Purchase Details */}
              <div className="pt-2 border-t space-y-2">
                <div className="flex items-center gap-2 text-xs">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <span>
                    Purchased: {item.purchase_date ? format(parseISO(item.purchase_date), 'MMM dd, yyyy') : '—'}
                  </span>
                </div>
                {item.source && (
                  <div className="flex items-center gap-2 text-xs">
                    <Package className="w-4 h-4 text-gray-500" />
                    <span>Source: {item.source}</span>
                  </div>
                )}
                {item.category && (
                  <div className="flex items-center gap-2 text-xs">
                    <Package className="w-4 h-4 text-gray-500" />
                    <span>Category: {item.category}</span>
                  </div>
                )}
                {item.condition && (
                  <div className="flex items-center gap-2 text-xs">
                    <Package className="w-4 h-4 text-gray-500" />
                    <span>Condition: {item.condition}</span>
                  </div>
                )}
                {item.brand && (
                  <div className="flex items-center gap-2 text-xs">
                    <Package className="w-4 h-4 text-gray-500" />
                    <span>Brand: {item.brand}</span>
                  </div>
                )}
                {item.size && (
                  <div className="flex items-center gap-2 text-xs">
                    <Package className="w-4 h-4 text-gray-500" />
                    <span>Size: {item.size}</span>
                  </div>
                )}
                {item.return_deadline && (
                  <div className="flex items-center gap-2 text-xs">
                    <Calendar className="w-4 h-4 text-orange-500" />
                    <span className="text-orange-600 dark:text-orange-400">
                      Return by: {format(parseISO(item.return_deadline), 'MMM dd, yyyy')}
                    </span>
                  </div>
                )}
              </div>

              {/* Tags */}
              {tags && tags.length > 0 && (
                <div className="pt-2 border-t">
                  <div className="flex items-center gap-2 mb-2">
                    <Tag className="w-4 h-4 text-gray-500" />
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Tags</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes - Expandable on desktop */}
              {item.notes && (
                <div className="pt-2 border-t">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Notes</p>
                    {shouldTruncateNotes && (
                      <button
                        onClick={() => setNotesExpanded(!notesExpanded)}
                        className="hidden md:flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                      >
                        {notesExpanded ? (
                          <>
                            <ChevronUp className="w-3 h-3" />
                            Show Less
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-3 h-3" />
                            Show More
                          </>
                        )}
                      </button>
                    )}
                  </div>
                  <p className="italic text-xs break-words text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    "{displayNotes}"
                  </p>
                </div>
              )}

              {/* Edit Button - Desktop only (mobile has it at top) */}
              <div className="hidden md:block pt-4 border-t">
                <Button
                  onClick={() => {
                    onClose();
                    navigate(createPageUrl(`AddInventoryItem?id=${item.id}`));
                  }}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <EditIcon className="w-4 h-4 mr-2" />
                  Edit Item
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

