# 🎨 Hellō Logo Design Guidance

## 📐 Display Area & Scaling

### **Maximum Display Area: 400px × 100px**
- Your logo will be **scaled to fit** within this area
- **Width priority:** Logo won't exceed 400px wide
- **Height priority:** Logo won't exceed 100px tall
- **Proportional scaling:** Aspect ratio is preserved

### **Scaling Examples:**
- **400×100px logo:** Displays at full size (perfect fit)
- **800×200px logo:** Scales down to 400×100px (50% scale)
- **200×200px logo:** Scales down to 100×100px (maintains square shape)
- **400×50px logo:** Displays at 400×50px (shorter but full width)

## 📄 File Requirements
- **Supported Formats:** .png, .gif, .jpg/.jpeg, .webp, .apng, .svg
- **Recommended Format:** PNG (for transparency support)
- **File Size:** Keep under 100KB for fast loading
- **Background:** Transparent PNG preferred for versatility

## 🌓 Theme Support - CRITICAL!

### **Why Both Light and Dark Logos Matter**
Hellō automatically adapts to users' browser theme preferences (light/dark mode). Having both versions ensures your brand looks great in all contexts.

### **Light Theme Logo**
- Use dark text/elements on transparent background
- Ensure good contrast against white/light backgrounds
- Consider your primary brand colors

### **Dark Theme Logo**  
- Use light text/elements on transparent background
- Ensure good contrast against dark backgrounds
- May use accent colors that pop on dark backgrounds

## 🎯 Design Recommendations by Logo Style

### **Text-Only Logos (Wordmarks)**
- **Ideal dimensions:** 300-400px × 60-80px
- **Font weight:** Medium to Bold for readability at small sizes
- **Letter spacing:** Slightly increased for better legibility
- **Consider:** How your text looks in both light and dark themes

### **Icon-Only Logos**
- **Ideal dimensions:** 80-100px × 80-100px (square preferred)
- **Detail level:** Simple, recognizable at 32px size
- **Contrast:** Strong silhouette that works in monochrome
- **Consider:** Whether icon is meaningful without company name

### **Icon + Text Combination**
- **Layout options:** Horizontal (icon left, text right) or vertical (icon top, text bottom)
- **Proportions:** Icon should be 60-80% of text height
- **Spacing:** 10-20px between icon and text
- **Hierarchy:** Ensure both elements are legible and balanced

### **Stylized Wordmarks**
- **Typography:** Custom lettering or heavily modified fonts
- **Consistency:** Maintain style across light and dark versions
- **Simplification:** Avoid thin strokes that disappear at small sizes
- **Scalability:** Test readability from 50px to 400px width

## 📋 Implementation Checklist

- [ ] Create light theme version (dark elements on transparent background)
- [ ] Create dark theme version (light elements on transparent background)
- [ ] Test both versions against their target backgrounds
- [ ] Ensure logos scale well from 50px to 400px width
- [ ] Optimize file sizes (aim for under 100KB each)
- [ ] Upload light theme logo using `hello_update_logo` with `theme: "light"`
- [ ] Upload dark theme logo using `hello_update_logo` with `theme: "dark"`
- [ ] Verify both logos appear in application state using `hello_read_application`

## 🛠️ Tools Available

- `hello_update_logo` - Update logo from URL or binary data with theme support
- `hello_read_application` - Read current application state including logo URLs
- `hello_update_application` - Update other application settings (logos are handled separately)

## 🎨 Brand Color Considerations

### Light Theme Recommendations:
- Use your brand colors as primary elements
- Ensure sufficient contrast (4.5:1 ratio minimum)
- Consider darker shades for better readability

### Dark Theme Recommendations:
- Use lighter tints of your brand colors
- Consider accent colors that complement your brand
- Test against dark backgrounds (#121212, #1e1e1e)

## 🔄 Logo Update Workflow

### Using the `hello_update_logo` Tool

The `hello_update_logo` tool handles the complete logo update process:

1. **Gets current application state** from the admin server
2. **Uploads your logo** (from URL or binary data)
3. **Updates the application** with the new logo URL
4. **Returns the full application state** including both `image_uri` and `dark_image_uri`

### Examples

```javascript
// Upload light theme logo from URL
{
  "publisher_id": "pub_123",
  "application_id": "app_456", 
  "image_url": "https://example.com/logo-light.png",
  "theme": "light"
}

// Upload dark theme logo from binary data
{
  "publisher_id": "pub_123",
  "application_id": "app_456",
  "image_data": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "theme": "dark"
}
```

### Reading Application State

Use `hello_read_application` to see both logo URLs:
- `image_uri` - Light theme logo (dark elements)
- `dark_image_uri` - Dark theme logo (light elements)

Need help with implementation? Check out our [logo documentation](https://www.hello.dev/docs/hello-buttons/#logos) for more details! 