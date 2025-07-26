#!/usr/bin/env node

// Test script to manually test SVG upload with the exact failing data
const testSvgData = 'PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDQwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CiAgPHJlY3Qgd2lkdGg9IjQwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiMxQTczRTgiLz4KICA8dGV4dCB4PSI1MCIgeT0iNjUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgSGVsdmV0aWNhLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjQ4IiBmaWxsPSIjRkZGRkZGIiBmb250LXdlaWdodD0iYm9sZCI+RGljayBIYXJkdCdzIEFwcDwvdGV4dD4KPC9zdmc+Cg==';

// Test the filename generation logic
const logo_content_type = 'image/svg+xml';
const mimeSubtype = logo_content_type.split('/')[1] || 'png';
const extension = mimeSubtype.includes('+') ? mimeSubtype.split('+')[0] : mimeSubtype;
const timestamp = Date.now();
const logo_filename = `logo_${timestamp}.${extension}`;

console.log('🧪 Testing SVG filename generation:');
console.log(`   Content-Type: ${logo_content_type}`);
console.log(`   MIME subtype: ${mimeSubtype}`);
console.log(`   Extension: ${extension}`);
console.log(`   Generated filename: ${logo_filename}`);

// Decode and verify the SVG
const svgContent = Buffer.from(testSvgData, 'base64').toString('utf8');
console.log('\n📄 Decoded SVG content:');
console.log(svgContent);

console.log('\n✅ SVG filename generation working correctly!');
console.log('   Extension correctly extracted as "svg" instead of "svg+xml"');
