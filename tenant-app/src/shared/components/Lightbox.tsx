/**
 * Lightbox Component
 * Modern, responsive lightbox for images with zoom, swipe, and keyboard navigation
 */

import React, { useEffect, useCallback, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import './Lightbox.css';

export interface LightboxImage {
  src: string;
  alt?: string;
  title?: string;
}

interface LightboxProps {
  isOpen: boolean;
  images: LightboxImage[];
  initialIndex?: number;
  onClose: () => void;
  showThumbnails?: boolean;
  enableZoom?: boolean;
  enableSwipe?: boolean;
}

export const Lightbox: React.FC<LightboxProps> = ({
  isOpen,
  images,
  initialIndex = 0,
  onClose,
  showThumbnails = false,
  enableZoom = true,
  enableSwipe = true,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isZoomed, setIsZoomed] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Define handlers first (before useEffect that uses them)
  const handleNext = useCallback(() => {
    if (currentIndex < images.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setZoomLevel(1);
      setPanPosition({ x: 0, y: 0 });
      setIsZoomed(false);
    }
  }, [currentIndex, images.length]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setZoomLevel(1);
      setPanPosition({ x: 0, y: 0 });
      setIsZoomed(false);
    }
  }, [currentIndex]);

  // Reset zoom when image changes
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
      setZoomLevel(1);
      setPanPosition({ x: 0, y: 0 });
      setIsZoomed(false);
    }
  }, [isOpen, initialIndex]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleNext, handlePrev, onClose]);

  // Prevent body scroll when lightbox is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleZoom = useCallback((delta: number, clientX?: number, clientY?: number) => {
    if (!enableZoom) return;

    const newZoom = Math.max(1, Math.min(5, zoomLevel + delta));
    setZoomLevel(newZoom);
    setIsZoomed(newZoom > 1);

    // Zoom towards mouse position
    if (clientX !== undefined && clientY !== undefined && imageRef.current && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = clientX - rect.left - rect.width / 2;
      const y = clientY - rect.top - rect.height / 2;
      setPanPosition({ x: x * (newZoom - 1) * 0.1, y: y * (newZoom - 1) * 0.1 });
    }
  }, [zoomLevel, enableZoom]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    // Eğer zoom yapılmışsa, wheel ile zoom yap
    if (enableZoom && isZoomed) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      handleZoom(delta, e.clientX, e.clientY);
      return;
    }
    
    // Zoom yapılmamışsa, wheel ile navigate et
    e.preventDefault();
    if (e.deltaY > 0) {
      // Scroll down = next
      handleNext();
    } else {
      // Scroll up = prev
      handlePrev();
    }
  }, [enableZoom, isZoomed, handleZoom, handleNext, handlePrev]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!isZoomed) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - panPosition.x, y: e.clientY - panPosition.y });
  }, [isZoomed, panPosition]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !isZoomed) return;
    setPanPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  }, [isDragging, isZoomed, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Touch handlers for swipe
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!enableSwipe) return;
    setTouchEnd(null);
    setTouchStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
  }, [enableSwipe]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!enableSwipe) return;
    setTouchEnd({ x: e.touches[0].clientX, y: e.touches[0].clientY });
  }, [enableSwipe]);

  const handleTouchEnd = useCallback(() => {
    if (!touchStart || !touchEnd || !enableSwipe) {
      setTouchStart(null);
      setTouchEnd(null);
      return;
    }

    const distanceX = touchStart.x - touchEnd.x;
    const distanceY = touchStart.y - touchEnd.y;
    const isLeftSwipe = distanceX > 50;
    const isRightSwipe = distanceX < -50;
    const isVerticalSwipe = Math.abs(distanceY) > Math.abs(distanceX);

    if (!isVerticalSwipe) {
      if (isLeftSwipe) {
        handleNext();
      } else if (isRightSwipe) {
        handlePrev();
      }
    }

    setTouchStart(null);
    setTouchEnd(null);
  }, [touchStart, touchEnd, enableSwipe, handleNext, handlePrev]);

  const handleImageClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Eğer zoom yapılmışsa, tıklayınca zoom'u kapat
    if (isZoomed) {
      setZoomLevel(1);
      setPanPosition({ x: 0, y: 0 });
      setIsZoomed(false);
      return;
    }
    
    // Zoom yapılmamışsa, görselin hangi tarafına tıklandığına göre navigate et
    if (imageRef.current) {
      const rect = imageRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const imageWidth = rect.width;
      const leftThird = imageWidth / 3;
      const rightThird = (imageWidth * 2) / 3;
      
      if (clickX < leftThird) {
        // Sol tarafa tıklandı - önceki görsel
        handlePrev();
      } else if (clickX > rightThird) {
        // Sağ tarafa tıklandı - sonraki görsel
        handleNext();
      } else {
        // Orta tarafa tıklandı - zoom yap
        handleZoom(1, e.clientX, e.clientY);
      }
    }
  }, [isZoomed, handleZoom, handleNext, handlePrev]);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    // Sadece backdrop'a tıklandığında kapat (görsel veya butonlara değilse)
    if (e.target === e.currentTarget && !isZoomed) {
      onClose();
    }
  }, [isZoomed, onClose]);

  // Early return AFTER all hooks
  if (!isOpen || images.length === 0) return null;

  const currentImage = images[currentIndex];

  const overlay = (
    <div
      ref={containerRef}
      className="lightbox-overlay fixed inset-0 backdrop-blur-sm flex items-center justify-center"
      onClick={handleBackdropClick}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      {/* Close Button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 text-white hover:text-gray-300 transition-colors p-2 rounded-full hover:bg-white/10"
        aria-label="Kapat"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Navigation Buttons */}
      {images.length > 1 && (
        <>
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className={`absolute left-4 top-1/2 -translate-y-1/2 z-10 text-white hover:text-gray-300 transition-colors p-3 rounded-full hover:bg-white/10 ${
              currentIndex === 0 ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            aria-label="Önceki"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={handleNext}
            disabled={currentIndex === images.length - 1}
            className={`absolute right-4 top-1/2 -translate-y-1/2 z-10 text-white hover:text-gray-300 transition-colors p-3 rounded-full hover:bg-white/10 ${
              currentIndex === images.length - 1 ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            aria-label="Sonraki"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}

      {/* Image Counter */}
      {images.length > 1 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 text-white text-sm bg-black/50 px-4 py-2 rounded-full">
          {currentIndex + 1} / {images.length}
        </div>
      )}

      {/* Main Image */}
      <div 
        className="relative max-w-[90vw] max-h-[90vh] flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          ref={imageRef}
          src={currentImage.src}
          alt={currentImage.alt || currentImage.title || 'Görsel'}
          className={`max-w-full max-h-[90vh] object-contain transition-transform duration-300 ${
            isZoomed ? 'cursor-move' : 'cursor-zoom-in'
          }`}
          style={{
            transform: `scale(${zoomLevel}) translate(${panPosition.x}px, ${panPosition.y}px)`,
          }}
          onClick={handleImageClick}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          draggable={false}
        />
      </div>

      {/* Thumbnails */}
      {showThumbnails && images.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex gap-2 max-w-[90vw] overflow-x-auto pb-2">
          {images.map((img, index) => (
            <button
              key={index}
              onClick={() => {
                setCurrentIndex(index);
                setZoomLevel(1);
                setPanPosition({ x: 0, y: 0 });
                setIsZoomed(false);
              }}
              className={`flex-shrink-0 w-20 h-20 rounded overflow-hidden border-2 transition-all ${
                index === currentIndex ? 'border-white' : 'border-transparent opacity-60 hover:opacity-100'
              }`}
            >
              <img
                src={img.src}
                alt={img.alt || ''}
                className="w-full h-full object-cover"
                draggable={false}
              />
            </button>
          ))}
        </div>
      )}

      {/* Zoom Controls */}
      {enableZoom && isZoomed && (
        <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-2">
          <button
            onClick={() => handleZoom(0.2)}
            className="text-white bg-black/50 hover:bg-black/70 p-2 rounded-full transition-colors"
            aria-label="Yakınlaştır"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </button>
          <button
            onClick={() => handleZoom(-0.2)}
            className="text-white bg-black/50 hover:bg-black/70 p-2 rounded-full transition-colors"
            aria-label="Uzaklaştır"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          <button
            onClick={() => {
              setZoomLevel(1);
              setPanPosition({ x: 0, y: 0 });
              setIsZoomed(false);
            }}
            className="text-white bg-black/50 hover:bg-black/70 p-2 rounded-full transition-colors"
            aria-label="Sıfırla"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.5M20 4v5h-.5M4 20v-5h.5M20 20v-5h-.5" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );

  return createPortal(overlay, document.body);
};

