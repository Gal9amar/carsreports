import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
})

export async function sendEmail(to: string, subject: string, html: string) {
  await transporter.sendMail({
    from: `"CarsReports" <${process.env.GMAIL_USER}>`,
    to, subject, html,
  })
}

export async function sendOtpEmail(to: string, code: string) {
  await transporter.sendMail({
    from: `"CarReports" <${process.env.GMAIL_USER}>`,
    to,
    subject: `קוד האימות שלך: ${code}`,
    html: `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 400px; margin: 0 auto;">
        <h2 style="color: #1e40af;">CarReports — אימות כניסה</h2>
        <p>קוד האימות שלך הוא:</p>
        <div style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #1e40af; padding: 20px; background: #f0f4ff; border-radius: 8px; text-align: center;">
          ${code}
        </div>
        <p style="color: #666; font-size: 14px;">הקוד תקף ל-10 דקות.<br/>אם לא ביקשת קוד זה, התעלם מהודעה זו.</p>
      </div>
    `,
  })
}
