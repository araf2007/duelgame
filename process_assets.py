import cv2
import numpy as np
import os

def process_sprite_sheet(input_path, output_path):
    print(f"Processing {input_path}...")
    
    # Read with alpha channel if present, otherwise BGR
    img = cv2.imread(input_path, cv2.IMREAD_UNCHANGED)
    if img is None:
        print(f"Failed to load {input_path}")
        return None
        
    # Convert to BGRA if it doesn't have an alpha channel
    if img.shape[2] == 3:
        img = cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)
        
    # Find white pixels (background)
    # White is usually close to 255,255,255. We'll use a threshold.
    b, g, r, a = cv2.split(img)
    white_mask = (r > 240) & (g > 240) & (b > 240)
    
    # Set white background to transparent
    a[white_mask] = 0
    img = cv2.merge((b, g, r, a))
    
    # To find bounding boxes, we use the alpha channel
    # Find contours on the non-transparent pixels
    _, thresh = cv2.threshold(a, 10, 255, cv2.THRESH_BINARY)
    
    # Morphological close to connect slightly disconnected pixels (like wands)
    kernel = np.ones((5, 5), np.uint8)
    thresh = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
    
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    boxes = []
    for cnt in contours:
        x, y, w, h = cv2.boundingRect(cnt)
        # Filter out noise or text labels
        # Text is usually very wide but short, or just very small
        if w > 15 and h > 20 and w < 200 and h < 200:
            if float(w)/h < 3.0: # Not a long line of text
                boxes.append((x, y, w, h))
                
    if not boxes:
        print(f"No valid sprites found in {input_path}")
        return None
        
    # Sort boxes into rows based on Y center
    # We assume rows are separated by at least 30 pixels
    boxes.sort(key=lambda b: b[1] + b[3]/2) 
    
    rows = []
    current_row = []
    last_y_center = boxes[0][1] + boxes[0][3]/2
    
    for box in boxes:
        y_center = box[1] + box[3]/2
        if abs(y_center - last_y_center) > 30:
            rows.append(current_row)
            current_row = []
        current_row.append(box)
        last_y_center = y_center
        
    rows.append(current_row)
    
    # Sort each row by X coordinate
    for row in rows:
        row.sort(key=lambda b: b[0])
        
    # Find max grid dimensions
    max_w = max(b[2] for r in rows for b in r)
    max_h = max(b[3] for r in rows for b in r)
    num_rows = len(rows)
    num_cols = max(len(r) for r in rows)
    
    print(f"Detected {num_rows} rows, max {num_cols} cols.")
    print(f"Max sprite size: {max_w}x{max_h}")
    
    # Add padding to frame
    padding = 10
    frame_w = max_w + padding*2
    frame_h = max_h + padding*2
    
    # Create new blank transparent image
    out_img = np.zeros((frame_h * num_rows, frame_w * num_cols, 4), dtype=np.uint8)
    
    # Paste sprites into the grid centered
    for r_idx, row in enumerate(rows):
        for c_idx, box in enumerate(row):
            x, y, w, h = box
            
            # Extract sprite from original image (using actual pixels, not morphed)
            sprite = img[y:y+h, x:x+w]
            
            # Calculate paste position (center in grid cell)
            paste_x = c_idx * frame_w + (frame_w - w) // 2
            paste_y = r_idx * frame_h + (frame_h - h) // 2
            
            # Create a mask of the sprite's alpha channel
            sprite_alpha = sprite[:, :, 3] / 255.0
            
            # Alpha blend onto output (which is currently all 0s anyway, so we can just set it)
            out_img[paste_y:paste_y+h, paste_x:paste_x+w] = sprite
            
    cv2.imwrite(output_path, out_img)
    print(f"Saved cleaned sprite sheet to {output_path}")
    print(f"PHASER CONFIG: frameWidth: {frame_w}, frameHeight: {frame_h}")
    return frame_w, frame_h

def process_background(input_path, output_path):
    print(f"Processing background {input_path}...")
    img = cv2.imread(input_path)
    if img is None:
        print(f"Failed to load {input_path}")
        return
        
    # Resize to exactly 800x600 for the game
    img_resized = cv2.resize(img, (800, 600))
    cv2.imwrite(output_path, img_resized)
    print(f"Saved resized background to {output_path}")

if __name__ == "__main__":
    public_dir = r"C:\Users\HP\Downloads\RupertsDuelClub\public"
    
    blue_in = os.path.join(public_dir, "blue_wiz_sprite.png")
    blue_out = os.path.join(public_dir, "blue_wiz_clean.png")
    
    red_in = os.path.join(public_dir, "red_wiz_sprite.png")
    red_out = os.path.join(public_dir, "red_wiz_clean.png")
    
    bg_in = os.path.join(public_dir, "duel_bg.png")
    bg_out = os.path.join(public_dir, "duel_bg_clean.png")
    
    if os.path.exists(blue_in):
        process_sprite_sheet(blue_in, blue_out)
    else:
        print("Missing blue wizard")
        
    if os.path.exists(red_in):
        process_sprite_sheet(red_in, red_out)
    else:
        print("Missing red wizard")
        
    if os.path.exists(bg_in):
        process_background(bg_in, bg_out)
    else:
        print("Missing background")
