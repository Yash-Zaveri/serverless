const sgMail = require("@sendgrid/mail");
const dotenv = require("dotenv");
const winston = require("winston");

// Load environment variables
dotenv.config();

// Configure SendGrid API
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Configure logging with Winston
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} - ${level.toUpperCase()}: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "email_service.log" }),
  ],
});

exports.handler = async (event) => {
  const baseURL = process.env.BASE_URL;

  logger.info("Handler triggered for email verification");

  try {
    for (const record of event.Records) {
      const snsMessage = JSON.parse(record.Sns.Message);
      const email = snsMessage.email;
      const verificationToken = snsMessage.verificationToken;

      // Construct the verification link
      const verificationLink = `http://${baseURL}/user/v1/user/self/verify?token=${verificationToken}`;
      logger.info(`Verification link created: ${verificationLink}`);

      // Set up the email content
      const msg = {
        to: email,
        from: `noreply@${baseURL}`,
        subject: "CSYE6225 Webapp - Verify Your Email",
        html: `<p>Dear User,<br>Please verify your email by <a href="${verificationLink}">clicking here</a>. This link expires in 2 minutes.<br><br>Thanks, <br>Yash Zaveri</p>`,
      };
      logger.info(`Prepared email to send to ${email}`);

      try {
        const response = await sgMail.send(msg);
        logger.info(
          `Email sent to ${email} with response: ${JSON.stringify(response)}`
        );
      } catch (error) {
        logger.error(`Failed to send email to ${email}: ${error}`);
        return {
          statusCode: 500,
          body: "Email sending failed",
        };
      }
    }
    logger.info("All emails processed successfully");
    return {
      statusCode: 200,
      body: "Verification email sent successfully",
    };
  } catch (error) {
    logger.error(`Error processing the verification: ${error}`);
    return {
      statusCode: 500,
      body: "An error occurred",
    };
  }
};