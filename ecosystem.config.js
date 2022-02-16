module.exports = {
    apps: [
        {
            name: "blood-donation",
            script: "app.js",
            watch: false,
            env: {
                "EMAIL": "blood.donation.mailer@gmail.com",
                "EMAIL_PASSWORD": "BloodDonationMailer@121",
                "DB_URL": "mongodb://localhost:27017/blood-donation-db",
				"SECRET": "this is a complex secret rat"
            }
        }
    ]
}