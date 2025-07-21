# 🔐 Hellō Login Button Implementation Guide

## 📖 Overview

This guide provides comprehensive instructions for implementing Hellō login buttons in your application. Instead of generating HTML code, we'll show you how to implement the buttons yourself with full customization control.

## 🚀 Quick Start

### 1. Basic HTML Implementation

```html
<!DOCTYPE html>
<html>
<head>
    <title>Hellō Login Example</title>
    <script src="https://cdn.hello.coop/js/hello-btn.js"></script>
</head>
<body>
    <hello-btn 
        client_id="YOUR_APPLICATION_ID"
        redirect_uri="YOUR_REDIRECT_URI"
        scope="openid name email">
        Continue with Hellō
    </hello-btn>
</body>
</html>
```

### 2. React Implementation

```jsx
import React from 'react';

const HelloButton = ({ clientId, redirectUri, onSuccess }) => {
  useEffect(() => {
    // Load Hello button script
    const script = document.createElement('script');
    script.src = 'https://cdn.hello.coop/js/hello-btn.js';
    document.head.appendChild(script);
    
    return () => {
      document.head.removeChild(script);
    };
  }, []);

  return (
    <hello-btn 
      client_id={clientId}
      redirect_uri={redirectUri}
      scope="openid name email"
    >
      Continue with Hellō
    </hello-btn>
  );
};
```

## ⚙️ Configuration Options

### Required Parameters

- **`client_id`**: Your Hellō application ID
- **`redirect_uri`**: Where to redirect after authentication

### Optional Parameters

- **`scope`**: Requested scopes (default: "openid name email")
- **`provider_hint`**: Preferred providers (see Provider Hints section)
- **`domain_hint`**: Account type preference
- **`login_hint`**: Pre-fill email or suggest login method
- **`nonce`**: Security nonce (recommended for production)
- **`state`**: Custom state parameter

## 🎯 Provider Hints

Customize which identity providers to promote or demote:

### Promote Providers (Target Audience)
```html
<!-- For Gaming Apps -->
<hello-btn provider_hint="discord">Login to Game</hello-btn>

<!-- For Developer Tools -->
<hello-btn provider_hint="github">Continue with GitHub</hello-btn>

<!-- For Business Apps -->
<hello-btn provider_hint="microsoft">Sign in with Microsoft</hello-btn>

<!-- Multiple Providers -->
<hello-btn provider_hint="github discord">Developer Login</hello-btn>
```

### Demote Providers
```html
<!-- Demote Google (add -- suffix) -->
<hello-btn provider_hint="github google--">Prefer GitHub</hello-btn>
```

### Available Providers
- `apple` - Apple ID
- `discord` - Discord
- `email` - Email/Password
- `ethereum` - Ethereum Wallet
- `facebook` - Facebook
- `github` - GitHub
- `gitlab` - GitLab
- `google` - Google
- `line` - LINE
- `mastodon` - Mastodon
- `microsoft` - Microsoft
- `qrcode` - QR Code
- `tumblr` - Tumblr
- `twitch` - Twitch
- `twitter` - Twitter/X
- `wordpress` - WordPress
- `yahoo` - Yahoo

## 🏢 Domain Hints

Control account type preferences:

```html
<!-- Personal accounts preferred -->
<hello-btn domain_hint="personal">Personal Login</hello-btn>

<!-- Business accounts preferred -->
<hello-btn domain_hint="managed">Business Login</hello-btn>

<!-- Specific domain -->
<hello-btn domain_hint="company.com">Company Login</hello-btn>
```

## 🎨 Styling & Themes

### Automatic Theme Detection
Hellō buttons automatically adapt to your site's theme:
- **Light theme**: Dark text on light background
- **Dark theme**: Light text on dark background

### Custom Styling
```css
hello-btn {
  --hello-btn-bg: #your-brand-color;
  --hello-btn-color: #your-text-color;
  --hello-btn-border: #your-border-color;
  --hello-btn-hover-bg: #your-hover-color;
}
```

### Size Variants
```html
<!-- Small -->
<hello-btn size="sm">Small Button</hello-btn>

<!-- Medium (default) -->
<hello-btn>Medium Button</hello-btn>

<!-- Large -->
<hello-btn size="lg">Large Button</hello-btn>
```

## 📱 Mobile Considerations

### Responsive Design
```html
<hello-btn 
  style="width: 100%; max-width: 300px;"
  client_id="YOUR_APP_ID"
  redirect_uri="YOUR_REDIRECT_URI">
  Continue with Hellō
</hello-btn>
```

### Mobile-Optimized Flow
```html
<hello-btn 
  target_uri="YOUR_MOBILE_DEEP_LINK"
  client_id="YOUR_APP_ID">
  Open in App
</hello-btn>
```

## 🔒 Security Best Practices

### Use PKCE (Proof Key for Code Exchange)
```javascript
// Generate PKCE parameters
const codeVerifier = generateCodeVerifier();
const codeChallenge = await generateCodeChallenge(codeVerifier);

// Store code_verifier securely for token exchange
sessionStorage.setItem('code_verifier', codeVerifier);
```

### Include State Parameter
```html
<hello-btn 
  state="YOUR_RANDOM_STATE"
  client_id="YOUR_APP_ID"
  redirect_uri="YOUR_REDIRECT_URI">
  Secure Login
</hello-btn>
```

### Use Nonce for ID Tokens
```html
<hello-btn 
  nonce="YOUR_RANDOM_NONCE"
  scope="openid name email"
  client_id="YOUR_APP_ID">
  Login with ID Token
</hello-btn>
```

## 🛠️ Implementation Examples

### E-commerce Site
```html
<hello-btn 
  client_id="YOUR_SHOP_ID"
  redirect_uri="https://shop.example.com/auth/callback"
  scope="openid name email"
  provider_hint="google apple"
  domain_hint="personal">
  Quick Checkout
</hello-btn>
```

### Developer Platform
```html
<hello-btn 
  client_id="YOUR_DEV_PLATFORM_ID"
  redirect_uri="https://dev.example.com/auth/callback"
  scope="openid name email"
  provider_hint="github gitlab"
  domain_hint="managed">
  Developer Sign In
</hello-btn>
```

### Gaming Application
```html
<hello-btn 
  client_id="YOUR_GAME_ID"
  redirect_uri="https://game.example.com/auth/callback"
  scope="openid name email picture"
  provider_hint="discord twitch"
  domain_hint="personal">
  Join Game
</hello-btn>
```

## 📋 Testing Checklist

- [ ] Button loads correctly in all target browsers
- [ ] Redirect URI is registered in your Hellō application
- [ ] HTTPS is enabled for production redirect URIs
- [ ] State parameter is validated on callback
- [ ] Error handling is implemented for failed logins
- [ ] Button styling matches your brand
- [ ] Mobile experience is optimized
- [ ] Provider hints work as expected

## 🔗 Additional Resources

- **[Hellō Button Documentation](https://www.hello.dev/docs/hello-buttons/)** - Complete API reference
- **[Scopes and Claims](https://www.hello.dev/docs/hello-scopes/)** - Available user data
- **[Wallet API](https://www.hello.dev/docs/apis/wallet/)** - Advanced configuration
- **[Security Best Practices](https://www.hello.dev/docs/security/)** - Production security guide

## 🎯 Pro Tips

1. **Consider Your Audience**: Use provider hints that match your user base
2. **Test Thoroughly**: Different providers have different UX flows
3. **Handle Errors**: Always implement proper error handling
4. **Monitor Performance**: Track login success rates by provider
5. **Stay Updated**: Check for new providers and features regularly

## 🆘 Need Help?

If you need assistance with implementation:
1. Check the [documentation](https://www.hello.dev/docs/)
2. Review the [examples repository](https://github.com/hellocoop/examples)
3. Join our [Discord community](https://discord.gg/hello)
4. Contact support at [help@hello.coop](mailto:help@hello.coop)

---

*This guide provides the foundation for implementing Hellō login buttons. For the most up-to-date information and advanced features, always refer to the official documentation at [hello.dev](https://www.hello.dev/docs/).* 