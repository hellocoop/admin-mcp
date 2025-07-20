// Legal document generator for MCP server
// Contains functions for generating Terms of Service and Privacy Policy documents

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Load markdown template from file
 * @param {string} templateName - Name of the template file (without .md extension)
 * @returns {string} - Template content
 */
function loadTemplate(templateName) {
  const templatePath = path.join(__dirname, 'markdown', `${templateName}.md`);
  try {
    return fs.readFileSync(templatePath, 'utf8');
  } catch (error) {
    console.error(`Error loading template ${templateName}:`, error);
    return '';
  }
}

/**
 * Replace template variables with actual values
 * @param {string} template - Template string with {{variable}} placeholders
 * @param {Object} variables - Object containing variable values
 * @returns {string} - Template with variables replaced
 */
function replaceTemplateVariables(template, variables) {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(regex, value || '');
  }
  return result;
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

  // Load template and replace variables
  const template = loadTemplate('terms-of-service-template');
  const variables = {
    current_date: currentDate,
    app_name,
    service_description: serviceDescription,
    company_name,
    service_type_description: getServiceDescription(service_type),
    age_section: ageSection,
    ugc_section: ugcSection,
    payment_section: paymentSection,
    ip_section: ipSection,
    dispute_section: disputeSection,
    contact_section: contactSection,
    governing_law
  };

  return replaceTemplateVariables(template, variables);
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

  // Load template and replace variables
  const template = loadTemplate('privacy-policy-template');
  const variables = {
    current_date: currentDate,
    company_name,
    app_name,
    data_collection_list: dataCollectionList,
    third_party_section: thirdPartySection,
    cookies_section: cookiesSection,
    marketing_section: marketingSection,
    children_section: childrenSection,
    international_section: internationalSection,
    data_retention_period,
    contact_section: contactSection,
    website_url
  };

  return replaceTemplateVariables(template, variables);
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
  // Load template and replace variables
  const template = loadTemplate('legal-guidance');
  
  const gdprCompliance = args.geographic_scope?.includes('European Union') || args.geographic_scope?.includes('EU') ? 
    '- **GDPR Compliance:** Consider additional GDPR requirements for EU users\n' : '';
  
  const ccpaCompliance = args.geographic_scope?.includes('California') ? 
    '- **CCPA Compliance:** Review California Consumer Privacy Act requirements\n' : '';
  
  const coppaCompliance = args.target_users === 'children_under_13' ? 
    '- **COPPA Compliance:** Ensure full compliance with Children\'s Online Privacy Protection Act\n' : '';
  
  const pciCompliance = args.payment_processing ? 
    '- **PCI DSS:** If handling payment data directly, ensure PCI DSS compliance\n' : '';

  const variables = {
    gdpr_compliance: gdprCompliance,
    ccpa_compliance: ccpaCompliance,
    coppa_compliance: coppaCompliance,
    pci_compliance: pciCompliance,
    website_url: args.website_url
  };

  return replaceTemplateVariables(template, variables);
} 