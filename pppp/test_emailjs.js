// Test script to verify EmailJS is working
// Run this in browser console on the app page

console.log("=".repeat(60));
console.log("TESTING EMAILJS CONFIGURATION");
console.log("=".repeat(60));

// Check environment variables
const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

console.log("\n1. Environment Variables:");
console.log(`   Service ID: ${serviceId || '❌ NOT SET'}`);
console.log(`   Template ID: ${templateId || '❌ NOT SET'}`);
console.log(`   Public Key: ${publicKey ? '✅ SET' : '❌ NOT SET'}`);

if (!serviceId || serviceId === 'YOUR_SERVICE_ID') {
    console.error("\n❌ EmailJS Service ID not configured!");
    console.log("   Update .env file with actual EmailJS credentials");
} else if (!templateId || templateId === 'YOUR_TEMPLATE_ID') {
    console.error("\n❌ EmailJS Template ID not configured!");
} else if (!publicKey || publicKey === 'YOUR_PUBLIC_KEY') {
    console.error("\n❌ EmailJS Public Key not configured!");
} else {
    console.log("\n✅ EmailJS is configured");
    console.log("\n2. Testing email send...");

    // Import emailjs
    import('@emailjs/browser').then(emailjs => {
        emailjs.send(
            serviceId,
            templateId,
            {
                to_email: 'test@example.com',
                to_name: 'Test User',
                subject: 'Test Email from SCRAP LINK',
                message: 'This is a test email to verify EmailJS configuration.'
            },
            publicKey
        ).then(
            (response) => {
                console.log('\n✅ TEST EMAIL SENT SUCCESSFULLY!', response);
                console.log('   Status:', response.status);
                console.log('   Text:', response.text);
            },
            (error) => {
                console.error('\n❌ TEST EMAIL FAILED:', error);
                console.log('   Check EmailJS dashboard for quota/errors');
            }
        );
    });
}

console.log("\n" + "=".repeat(60));
