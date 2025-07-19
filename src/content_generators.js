// Content generators for MCP server
// Contains functions for generating documentation, legal documents, and guidance content

import { SUPPORTED_MIMETYPES } from './utils.js';

/**
 * Generate logo guidance resource content
 * @returns {string} - Markdown content for logo guidance
 */
export function generateLogoGuidanceResource() {
  return `# 🎨 Hellō Logo Design Guidance

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
- [ ] Upload light theme logo using \`hello_update_logo\` with \`theme: "light"\`
- [ ] Upload dark theme logo using \`hello_update_logo\` with \`theme: "dark"\`
- [ ] Verify both logos appear in application state using \`hello_read_application\`

## 🛠️ Tools Available

- \`hello_update_logo\` - Update logo from URL or binary data with theme support
- \`hello_read_application\` - Read current application state including logo URLs
- \`hello_update_application\` - Update other application settings (logos are handled separately)

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

### Using the \`hello_update_logo\` Tool

The \`hello_update_logo\` tool handles the complete logo update process:

1. **Gets current application state** from the admin server
2. **Uploads your logo** (from URL or binary data)
3. **Updates the application** with the new logo URL
4. **Returns the full application state** including both \`image_uri\` and \`dark_image_uri\`

### Examples

\`\`\`javascript
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
\`\`\`

### Reading Application State

Use \`hello_read_application\` to see both logo URLs:
- \`image_uri\` - Light theme logo (dark elements)
- \`dark_image_uri\` - Dark theme logo (light elements)

Need help with implementation? Check out our [logo documentation](https://www.hello.dev/docs/hello-buttons/#logos) for more details!`;
}

/**
 * Generate login button guidance resource content
 * @returns {string} - Markdown content for login button guidance
 */
export function generateLoginButtonGuidanceResource() {
  return `# 🔐 Hellō Login Button Implementation Guide

## 📖 Overview

This guide provides comprehensive instructions for implementing Hellō login buttons in your application. Instead of generating HTML code, we'll show you how to implement the buttons yourself with full customization control.

## 🚀 Quick Start

### 1. Basic HTML Implementation

\`\`\`html
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
\`\`\`

### 2. React Implementation

\`\`\`jsx
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
\`\`\`

### 3. Next.js Implementation

\`\`\`jsx
import { useEffect } from 'react';
import Script from 'next/script';

export default function LoginPage() {
  return (
    <>
      <Script src="https://cdn.hello.coop/js/hello-btn.js" />
      <hello-btn 
        client_id={NEXT_PUBLIC_HELLO_CLIENT_ID}
        redirect_uri={NEXT_PUBLIC_REDIRECT_URI}
        scope="openid name email"
      >
        Continue with Hellō
      </hello-btn>
    </>
  );
}
\`\`\`

## ⚙️ Configuration Options

### Required Parameters

- **\`client_id\`**: Your Hellō application ID
- **\`redirect_uri\`**: Where to redirect after authentication

### Optional Parameters

- **\`scope\`**: Requested scopes (default: "openid name email")
- **\`provider_hint\`**: Preferred providers (see Provider Hints section)
- **\`domain_hint\`**: Account type preference
- **\`login_hint\`**: Pre-fill email or suggest login method
- **\`nonce\`**: Security nonce (recommended for production)
- **\`state\`**: Custom state parameter

## 🎯 Provider Hints

Customize which identity providers to promote or demote:

### Promote Providers (Target Audience)
\`\`\`html
<!-- For Gaming Apps -->
<hello-btn provider_hint="discord">Login to Game</hello-btn>

<!-- For Developer Tools -->
<hello-btn provider_hint="github">Continue with GitHub</hello-btn>

<!-- For Business Apps -->
<hello-btn provider_hint="microsoft">Sign in with Microsoft</hello-btn>

<!-- Multiple Providers -->
<hello-btn provider_hint="github discord">Developer Login</hello-btn>
\`\`\`

### Demote Providers
\`\`\`html
<!-- Demote Google (add -- suffix) -->
<hello-btn provider_hint="github google--">Prefer GitHub</hello-btn>
\`\`\`

### Available Providers
- \`apple\` - Apple ID
- \`discord\` - Discord
- \`email\` - Email/Password
- \`ethereum\` - Ethereum Wallet
- \`facebook\` - Facebook
- \`github\` - GitHub
- \`gitlab\` - GitLab
- \`google\` - Google
- \`line\` - LINE
- \`mastodon\` - Mastodon
- \`microsoft\` - Microsoft
- \`qrcode\` - QR Code
- \`tumblr\` - Tumblr
- \`twitch\` - Twitch
- \`twitter\` - Twitter/X
- \`wordpress\` - WordPress
- \`yahoo\` - Yahoo

## 🏢 Domain Hints

Control account type preferences:

\`\`\`html
<!-- Personal accounts preferred -->
<hello-btn domain_hint="personal">Personal Login</hello-btn>

<!-- Business accounts preferred -->
<hello-btn domain_hint="managed">Business Login</hello-btn>

<!-- Specific domain -->
<hello-btn domain_hint="company.com">Company Login</hello-btn>
\`\`\`

## 🎨 Styling & Themes

### Automatic Theme Detection
Hellō buttons automatically adapt to your site's theme:
- **Light theme**: Dark text on light background
- **Dark theme**: Light text on dark background

### Custom Styling
\`\`\`css
hello-btn {
  --hello-btn-bg: #your-brand-color;
  --hello-btn-color: #your-text-color;
  --hello-btn-border: #your-border-color;
  --hello-btn-hover-bg: #your-hover-color;
}
\`\`\`

### Size Variants
\`\`\`html
<!-- Small -->
<hello-btn size="sm">Small Button</hello-btn>

<!-- Medium (default) -->
<hello-btn>Medium Button</hello-btn>

<!-- Large -->
<hello-btn size="lg">Large Button</hello-btn>
\`\`\`

## 📱 Mobile Considerations

### Responsive Design
\`\`\`html
<hello-btn 
  style="width: 100%; max-width: 300px;"
  client_id="YOUR_APP_ID"
  redirect_uri="YOUR_REDIRECT_URI">
  Continue with Hellō
</hello-btn>
\`\`\`

### Mobile-Optimized Flow
\`\`\`html
<hello-btn 
  target_uri="YOUR_MOBILE_DEEP_LINK"
  client_id="YOUR_APP_ID">
  Open in App
</hello-btn>
\`\`\`

## 🔒 Security Best Practices

### Use PKCE (Proof Key for Code Exchange)
\`\`\`javascript
// Generate PKCE parameters
const codeVerifier = generateCodeVerifier();
const codeChallenge = await generateCodeChallenge(codeVerifier);

// Store code_verifier securely for token exchange
sessionStorage.setItem('code_verifier', codeVerifier);
\`\`\`

### Include State Parameter
\`\`\`html
<hello-btn 
  state="YOUR_RANDOM_STATE"
  client_id="YOUR_APP_ID"
  redirect_uri="YOUR_REDIRECT_URI">
  Secure Login
</hello-btn>
\`\`\`

### Use Nonce for ID Tokens
\`\`\`html
<hello-btn 
  nonce="YOUR_RANDOM_NONCE"
  scope="openid name email"
  client_id="YOUR_APP_ID">
  Login with ID Token
</hello-btn>
\`\`\`

## 🛠️ Implementation Examples

### E-commerce Site
\`\`\`html
<hello-btn 
  client_id="YOUR_SHOP_ID"
  redirect_uri="https://shop.example.com/auth/callback"
  scope="openid name email"
  provider_hint="google apple"
  domain_hint="personal">
  Quick Checkout
</hello-btn>
\`\`\`

### Developer Platform
\`\`\`html
<hello-btn 
  client_id="YOUR_DEV_PLATFORM_ID"
  redirect_uri="https://dev.example.com/auth/callback"
  scope="openid name email"
  provider_hint="github gitlab"
  domain_hint="managed">
  Developer Sign In
</hello-btn>
\`\`\`

### Gaming Application
\`\`\`html
<hello-btn 
  client_id="YOUR_GAME_ID"
  redirect_uri="https://game.example.com/auth/callback"
  scope="openid name email picture"
  provider_hint="discord twitch"
  domain_hint="personal">
  Join Game
</hello-btn>
\`\`\`

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

*This guide provides the foundation for implementing Hellō login buttons. For the most up-to-date information and advanced features, always refer to the official documentation at [hello.dev](https://www.hello.dev/docs/).*`;
}

/**
 * Generate supported logo formats resource content
 * @returns {Object} - JSON object with supported formats information
 */
export function generateSupportedLogoFormatsResource() {
  return {
    supportedMimeTypes: SUPPORTED_MIMETYPES,
    supportedExtensions: ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.apng', '.svg'],
    recommendedFormat: 'PNG',
    maxFileSize: '100KB',
    notes: [
      'PNG format is recommended for transparency support',
      'SVG files are sanitized for security',
      'All images are scaled to fit within 400px × 100px',
      'Both light and dark theme versions are recommended',
      'Image data must include data URL prefix (e.g., data:image/png;base64,...)'
    ]
  };
}

/**
 * Generate comprehensive legal documents
 * @param {Object} args - Legal document parameters
 * @returns {Object} - MCP-formatted response with legal documents
 */
export async function generateLegalDocs(args) {
  const {
    company_name,
    app_name,
    contact_email,
    website_url,
    physical_address,
    data_collection = ['name', 'email', 'profile picture'],
    service_type,
    target_users,
    geographic_scope = ['United States'],
    third_party_services = [],
    user_generated_content = false,
    payment_processing = false,
    subscription_model = false,
    data_retention_period = 'until account deletion',
    cookies_tracking = true,
    marketing_communications = false,
    age_restrictions = '13',
    intellectual_property = false,
    dispute_resolution = 'courts',
    governing_law = 'Delaware'
  } = args;
  
  const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  
  // Generate comprehensive Terms of Service
  const termsOfService = generateTermsOfService({
    company_name, app_name, contact_email, website_url, physical_address,
    service_type, target_users, user_generated_content, payment_processing,
    subscription_model, age_restrictions, intellectual_property,
    dispute_resolution, governing_law, currentDate
  });
  
  // Generate comprehensive Privacy Policy
  const privacyPolicy = generatePrivacyPolicy({
    company_name, app_name, contact_email, website_url, physical_address,
    data_collection, geographic_scope, third_party_services,
    data_retention_period, cookies_tracking, marketing_communications,
    age_restrictions, currentDate
  });

  // Generate guidance for next steps
  const guidance = generateLegalGuidance(args);

  return {
    contents: [{
      type: 'text',
      text: `Generated comprehensive legal documents for **${app_name}**:\n\n## Terms of Service\n\n\`\`\`markdown\n${termsOfService}\n\`\`\`\n\n## Privacy Policy\n\n\`\`\`markdown\n${privacyPolicy}\n\`\`\`\n\n${guidance}`
    }]
  };
}

/**
 * Generate Terms of Service document
 * @param {Object} params - Terms of Service parameters
 * @returns {string} - Markdown formatted Terms of Service
 */
export function generateTermsOfService(params) {
  const {
    company_name, app_name, contact_email, website_url, physical_address,
    service_type, target_users, user_generated_content, payment_processing,
    subscription_model, age_restrictions, intellectual_property,
    dispute_resolution, governing_law, currentDate
  } = params;

  const serviceDescription = {
    'web_app': 'web application',
    'mobile_app': 'mobile application', 
    'saas': 'software-as-a-service platform',
    'ecommerce': 'e-commerce platform',
    'social': 'social networking service',
    'marketplace': 'online marketplace',
    'blog': 'blog or content platform',
    'portfolio': 'portfolio website'
  }[service_type] || 'online service';

  const contactSection = physical_address ? 
    `For questions about these Terms, contact us at:\n- Email: ${contact_email}\n- Address: ${physical_address}` :
    `For questions about these Terms, contact us at: ${contact_email}`;

  const ageSection = target_users === 'children_under_13' ? 
    `## 4. Age Requirements and Parental Consent\nOur Service is designed for children under 13 with parental consent. We comply with COPPA requirements. Parents must provide verifiable consent before children can use our Service.` :
    age_restrictions !== '13' ? 
    `## 4. Age Requirements\nYou must be at least ${age_restrictions} years old to use our Service. By using our Service, you represent that you meet this age requirement.` :
    `## 4. Age Requirements\nYou must be at least 13 years old to use our Service. By using our Service, you represent that you are at least 13 years old.`;

  const ugcSection = user_generated_content ? `

## 6. User-Generated Content
By posting content to our Service, you grant us a non-exclusive, royalty-free license to use, display, and distribute your content. You are responsible for ensuring your content does not violate any laws or third-party rights.

### Content Guidelines
- Content must be lawful and not infringe on others' rights
- We reserve the right to remove content that violates these guidelines
- You retain ownership of your content` : '';

  const paymentSection = payment_processing ? `

## 7. Payment Terms
${subscription_model ? 
  `### Subscription Billing
- Subscriptions are billed in advance on a recurring basis
- You may cancel your subscription at any time
- Refunds are provided according to our refund policy

### Payment Processing
- We use third-party payment processors
- You agree to provide accurate payment information
- You are responsible for all charges incurred` :
  `### Payment Processing
- We use secure third-party payment processors
- All transactions are processed securely
- You are responsible for all charges incurred`}` : '';

  const ipSection = intellectual_property ? `

## 8. Intellectual Property
Our Service and its content are protected by copyright, trademark, and other intellectual property laws. You may not copy, modify, or distribute our content without permission.` : '';

  const disputeSection = dispute_resolution === 'arbitration' ?
    `## 10. Dispute Resolution
Any disputes arising from these Terms will be resolved through binding arbitration rather than in court. You waive your right to participate in class action lawsuits.` :
    dispute_resolution === 'mediation' ?
    `## 10. Dispute Resolution
We encourage resolving disputes through mediation before pursuing legal action. If mediation fails, disputes will be resolved in the courts of ${governing_law}.` :
    `## 10. Dispute Resolution
Any disputes arising from these Terms will be resolved in the courts of ${governing_law}. You consent to the jurisdiction of these courts.`;

  return `# Terms of Service

**Effective Date:** ${currentDate}

## 1. Introduction
Welcome to ${app_name}, a ${serviceDescription} operated by ${company_name}. By using our Service, you agree to these Terms of Service ("Terms").

## 2. Description of Service
${app_name} provides ${getServiceDescription(service_type)}. We reserve the right to modify or discontinue our Service at any time.

## 3. User Accounts
- You are responsible for maintaining the security of your account
- You must provide accurate and complete information
- You are responsible for all activities under your account

${ageSection}

## 5. Acceptable Use
You agree not to:
- Use our Service for illegal purposes
- Attempt to gain unauthorized access to our systems
- Interfere with the proper functioning of our Service
- Violate any applicable laws or regulations

${ugcSection}

${paymentSection}

${ipSection}

## 9. Limitation of Liability
Our Service is provided "as is" without warranties. We are not liable for any indirect, incidental, or consequential damages arising from your use of our Service.

${disputeSection}

## 11. Changes to Terms
We may update these Terms at any time. Continued use of our Service after changes constitutes acceptance of the new Terms.

## 12. Contact Information
${contactSection}

## 13. Governing Law
These Terms are governed by the laws of ${governing_law}.`;
}

/**
 * Generate Privacy Policy document
 * @param {Object} params - Privacy Policy parameters
 * @returns {string} - Markdown formatted Privacy Policy
 */
export function generatePrivacyPolicy(params) {
  const {
    company_name, app_name, contact_email, website_url, physical_address,
    data_collection, geographic_scope, third_party_services,
    data_retention_period, cookies_tracking, marketing_communications,
    age_restrictions, currentDate
  } = params;

  const contactSection = physical_address ? 
    `For questions about this Privacy Policy, contact us at:\n- Email: ${contact_email}\n- Address: ${physical_address}` :
    `For questions about this Privacy Policy, contact us at: ${contact_email}`;

  const dataCollectionList = data_collection.map(item => `- ${item}`).join('\n');
  
  const thirdPartySection = third_party_services.length > 0 ? `

## 4. Third-Party Services
We use the following third-party services that may collect information:

${third_party_services.map(service => `- ${service}`).join('\n')}

Please review the privacy policies of these services to understand how they handle your data.` : '';

  const cookiesSection = cookies_tracking ? `

## 5. Cookies and Tracking
We use cookies and similar technologies to:
- Remember your preferences
- Analyze how you use our Service
- Improve our Service performance

You can control cookies through your browser settings, but some features may not work properly if cookies are disabled.` : '';

  const marketingSection = marketing_communications ? `

## 6. Marketing Communications
With your consent, we may send you:
- Product updates and announcements
- Promotional offers and newsletters
- Service-related communications

You can opt out of marketing communications at any time by following the unsubscribe instructions in our emails.` : '';

  const childrenSection = age_restrictions === '13' || parseInt(age_restrictions) < 13 ? `

## 7. Children's Privacy
Our Service is not intended for children under ${age_restrictions}. We do not knowingly collect personal information from children under ${age_restrictions}. If you believe we have collected information from a child under ${age_restrictions}, please contact us immediately.` : '';

  const internationalSection = geographic_scope.some(region => 
    region.includes('United States') || region.includes('US') || region.includes('North America')
  ) ? `

## 8. International Data Transfers
Your information may be transferred to and processed in the United States and other countries where our servers are located. If you are located outside these regions, your information may be transferred to and processed in these countries. By using our Service, you consent to such transfers.` : '';

  return `# Privacy Policy

**Effective Date:** ${currentDate}

## 1. Introduction
${company_name} ("we," "our," or "us") operates ${app_name} (the "Service"). This Privacy Policy explains how we collect, use, and protect your personal information.

## 2. Information We Collect
We collect the following types of information:

${dataCollectionList}

### How We Collect Information
- **Directly from you:** When you create an account, contact us, or use our features
- **Automatically:** Through cookies, log files, and analytics tools
- **From third parties:** Through social media logins and integrated services

## 3. How We Use Your Information
We use your information to:
- Provide and improve our Service
- Communicate with you about your account
- Comply with legal obligations
- Protect against fraud and abuse

${thirdPartySection}

${cookiesSection}

${marketingSection}

${childrenSection}

${internationalSection}

## 9. Data Retention
We retain your personal information for ${data_retention_period}. You may request deletion of your account and associated data at any time.

## 10. Your Rights
Depending on your location, you may have the right to:
- Access your personal information
- Correct inaccurate information
- Delete your personal information
- Object to processing
- Data portability

## 11. Security
We implement appropriate security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.

## 12. Changes to This Policy
We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new policy on our website.

## 13. Contact Us
${contactSection}

For more information about our privacy practices, please visit: ${website_url}`;
}

/**
 * Get service description based on service type
 * @param {string} serviceType - Type of service
 * @returns {string} - Service description
 */
export function getServiceDescription(serviceType) {
  switch (serviceType) {
    case 'web_app':
      return 'a web-based application that allows users to access our features through their browser';
    case 'mobile_app':
      return 'a mobile application available for download on mobile devices';
    case 'saas':
      return 'a cloud-based software solution accessible via subscription';
    case 'ecommerce':
      return 'an online platform for buying and selling products or services';
    case 'social':
      return 'a social networking platform for connecting and sharing with others';
    case 'marketplace':
      return 'an online marketplace connecting buyers and sellers';
    case 'blog':
      return 'a content platform for publishing and sharing articles and media';
    case 'portfolio':
      return 'a portfolio website for showcasing work and professional information';
    default:
      return 'an online service platform';
  }
}

/**
 * Generate legal guidance content
 * @param {Object} args - Legal document arguments
 * @returns {string} - Markdown formatted guidance
 */
export function generateLegalGuidance(args) {
  return `

## 📋 Next Steps

### 1. Review and Customize
- **Legal Review:** Have these documents reviewed by a qualified attorney
- **Customize:** Modify language to match your specific business practices
- **Industry-Specific:** Add any industry-specific requirements or disclaimers

### 2. Implementation
- **Host Documents:** Upload these documents to your website
- **Link from App:** Add links to Terms and Privacy Policy in your application
- **Update Hellō App:** Use the URLs in your Hellō application configuration

### 3. Compliance Considerations
${args.geographic_scope?.includes('European Union') || args.geographic_scope?.includes('EU') ? '- **GDPR Compliance:** Consider additional GDPR requirements for EU users\n' : ''}${args.geographic_scope?.includes('California') ? '- **CCPA Compliance:** Review California Consumer Privacy Act requirements\n' : ''}${args.target_users === 'children_under_13' ? '- **COPPA Compliance:** Ensure full compliance with Children\'s Online Privacy Protection Act\n' : ''}${args.payment_processing ? '- **PCI DSS:** If handling payment data directly, ensure PCI DSS compliance\n' : ''}

### 4. Regular Updates
- **Annual Review:** Review and update these documents annually
- **Business Changes:** Update when your business practices change
- **Legal Changes:** Stay informed about relevant legal developments

### 5. Hellō Integration
After hosting these documents, update your Hellō application:

\`\`\`javascript
// Use hello_update_application with your URLs
{
  "tos_uri": "https://${args.website_url}/terms-of-service",
  "pp_uri": "https://${args.website_url}/privacy-policy"
}
\`\`\`

⚠️  **Important:** These are template documents. Always consult with a qualified attorney to ensure compliance with applicable laws and regulations for your specific situation.`;
} 