#!/usr/bin/env python3
"""
Simple background removal script using rembg library.
Falls back to a simple threshold-based approach if rembg is not available.
"""

import sys
import os
from PIL import Image

def remove_background_simple(input_path, output_path, threshold_percentile=10):
    """Improved background removal using edge detection and color analysis

    Args:
        input_path: Path to input image
        output_path: Path to save output image
        threshold_percentile: Percentile for adaptive threshold (5-30, default 10)
                             Lower = more aggressive removal
                             Higher = more conservative removal
    """
    try:
        from PIL import ImageFilter, ImageChops, ImageDraw
        import numpy as np

        img = Image.open(input_path).convert('RGBA')
        width, height = img.size

        # Convert to numpy array for processing
        img_array = np.array(img)

        # Sample corner pixels to determine background color
        corners = [
            img_array[0:10, 0:10],       # top-left
            img_array[0:10, -10:],        # top-right
            img_array[-10:, 0:10],        # bottom-left
            img_array[-10:, -10:]         # bottom-right
        ]

        # Calculate average corner color (likely background)
        corner_pixels = np.concatenate([c.reshape(-1, 4) for c in corners])
        bg_color = np.median(corner_pixels, axis=0)[:3]  # RGB only

        # Create mask based on color similarity to background
        rgb_array = img_array[:, :, :3]
        color_diff = np.sqrt(np.sum((rgb_array - bg_color) ** 2, axis=2))

        # Adaptive threshold based on image characteristics
        threshold = np.percentile(color_diff, threshold_percentile)  # Use provided percentile
        threshold = max(threshold, 30)  # Minimum threshold

        # Create alpha mask (255 = opaque, 0 = transparent)
        alpha = np.where(color_diff > threshold, 255, 0).astype(np.uint8)

        # Apply some smoothing to reduce jagged edges
        alpha_img = Image.fromarray(alpha, mode='L')
        alpha_img = alpha_img.filter(ImageFilter.GaussianBlur(radius=1))
        alpha_array = np.array(alpha_img)

        # Set the alpha channel
        img_array[:, :, 3] = alpha_array

        # Convert back to PIL Image
        result = Image.fromarray(img_array, 'RGBA')

        # Save as PNG to preserve transparency
        result.save(output_path, 'PNG')
        return True
    except Exception as e:
        print(f"Error in simple background removal: {e}", file=sys.stderr)
        return False

def remove_background_rembg(input_path, output_path):
    """Use rembg for high-quality background removal"""
    try:
        from rembg import remove

        with open(input_path, 'rb') as input_file:
            input_data = input_file.read()

        output_data = remove(input_data)

        with open(output_path, 'wb') as output_file:
            output_file.write(output_data)

        return True
    except ImportError:
        return False
    except Exception as e:
        print(f"Error in rembg: {e}", file=sys.stderr)
        return False

def main():
    if len(sys.argv) < 3 or len(sys.argv) > 4:
        print("Usage: python3 remove_bg.py <input_path> <output_path> [threshold_percentile]", file=sys.stderr)
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2]
    threshold_percentile = int(sys.argv[3]) if len(sys.argv) == 4 else 10

    if not os.path.exists(input_path):
        print(f"Input file not found: {input_path}", file=sys.stderr)
        sys.exit(1)

    # Try rembg first, fall back to simple method
    success = remove_background_rembg(input_path, output_path)

    if not success:
        print("rembg not available, using simple threshold method", file=sys.stderr)
        success = remove_background_simple(input_path, output_path, threshold_percentile)

    if success:
        print(f"Successfully removed background: {output_path}")
        sys.exit(0)
    else:
        print("Failed to remove background", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()
