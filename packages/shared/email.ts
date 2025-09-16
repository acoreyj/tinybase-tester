import { AwsClient } from "aws4fetch";
import { createMimeMessage } from "mimetext/browser";
export type MailOptions = {
	to: string;
	name?: string;
	imageUrl?: string;
	AWS_ACCESS_KEY_ID: string;
	AWS_SECRET_ACCESS_KEY: string;
};

// Function to send an email
async function sendEmail(
	toAddress: string,
	subject: string,
	html: string,
	{
		AWS_ACCESS_KEY_ID,
		AWS_SECRET_ACCESS_KEY,
	}: { AWS_ACCESS_KEY_ID: string; AWS_SECRET_ACCESS_KEY: string },
) {
	console.log({
		toAddress,
		subject,
		html,
		AWS_ACCESS_KEY_ID,
		AWS_SECRET_ACCESS_KEY,
	});
	const email_message = createMimeMessage();
	email_message.setSender({
		name: "Tabletop Companion",
		addr: "contact@tabletopcompanion.com",
	});
	email_message.setTo({
		addr: toAddress,
	});

	email_message.setSubject(subject);
	email_message.addMessage({
		contentType: "text/html",
		data: html,
		encoding: "7bit",
		charset: "utf-8",
	});

	const body = {
		Content: {
			Raw: {
				Data: utf8ToBase64(email_message.asRaw()),
			},
		},
	};

	const aws_client = new AwsClient({
		accessKeyId: AWS_ACCESS_KEY_ID,
		secretAccessKey: AWS_SECRET_ACCESS_KEY,
		service: "ses",
		retries: 0,
	});

	try {
		const response = await aws_client.fetch(
			`https://email.us-east-2.amazonaws.com/v2/email/outbound-emails`,
			{
				body: JSON.stringify(body),
				headers: {
					"Content-Type": "application/json",
				},
			},
		);
		if (!response.ok) {
			console.error("Failed to send email", response);
			throw new Error(`SES response not ok: ${response.status}`);
		}
		const res_json = (await response.json()) as { MessageId: string };
		if (res_json.MessageId) {
			console.log(`SES response body: ${JSON.stringify(res_json)}`);
			return { data: res_json };
		} else {
			console.error("Failed to send email", res_json);
			throw new Error("Failed to send email");
		}
	} catch (error) {
		console.error("Error sending email:", error);
		return { error: error as Error };
	}
}

export async function sendMagicLinkEmail(
	options: MailOptions & { url: string },
) {
	const html = template({
		topNotes: [
			"Click the button below to login and confirm your email address.",
		],
		link: options.url,
		linkText: "Confirm your email address",
		expires: "This link will expire in 30 minutes.",
	});
	return await sendEmail(options.to, "Tabletop Companion Confirmation", html, {
		AWS_ACCESS_KEY_ID: options.AWS_ACCESS_KEY_ID,
		AWS_SECRET_ACCESS_KEY: options.AWS_SECRET_ACCESS_KEY,
	});
}

export async function sendResetPasswordEmail(
	options: MailOptions & { url: string },
) {
	const name = options.name || options.to.split("@")[0];

	const html = template({
		topNotes: [
			`Hello ${name},`,
			"Click the button below to reset your password.",
		],
		link: options.url,
		linkText: "Reset your password",
		expires: "This link will expire in 1 hour.",
	});
	return await sendEmail(options.to, "Reset your password", html, {
		AWS_ACCESS_KEY_ID: options.AWS_ACCESS_KEY_ID,
		AWS_SECRET_ACCESS_KEY: options.AWS_SECRET_ACCESS_KEY,
	});
}

export async function sendVerificationEmail(
	options: MailOptions & { url: string },
) {
	const name = options.name || options.to.split("@")[0];
	const html = template({
		topNotes: [
			`Hello ${name},`,
			"Click the button below to verify your email address.",
		],
		link: options.url,
		linkText: "Verify your email address",
		expires: "This link will expire in 1 hour.",
	});

	return await sendEmail(options.to, "Verify your email address", html, {
		AWS_ACCESS_KEY_ID: options.AWS_ACCESS_KEY_ID,
		AWS_SECRET_ACCESS_KEY: options.AWS_SECRET_ACCESS_KEY,
	});
}

export async function sendWelcomeEmail(options: MailOptions & { url: string }) {
	const name = options.name || options.to.split("@")[0];

	const html = template({
		topNotes: [
			`Hello ${name},`,
			"Welcome to Tabletop Companion!",
			"Click the button below to verify your email address.",
		],
		link: options.url,
		linkText: "Verify your email address",
		expires: "This link will expire in 1 hour.",
	});
	return await sendEmail(options.to, "Welcome to Tabletop Companion", html, {
		AWS_ACCESS_KEY_ID: options.AWS_ACCESS_KEY_ID,
		AWS_SECRET_ACCESS_KEY: options.AWS_SECRET_ACCESS_KEY,
	});
}

export async function sendPriceAlertEmail(
	options: MailOptions & { url: string; price: number; productName: string },
) {
	const name = options.name || options.to.split("@")[0];
	const html = template({
		topNotes: [
			`Hello ${name},`,
			`The price of ${options.productName} has dropped to $${options.price}.`,
		],
		link: options.url,
		linkText: "View the product",
	});
	return await sendEmail(options.to, "Price Alert", html, {
		AWS_ACCESS_KEY_ID: options.AWS_ACCESS_KEY_ID,
		AWS_SECRET_ACCESS_KEY: options.AWS_SECRET_ACCESS_KEY,
	});
}

function encodeBase64Bytes(bytes: Uint8Array): string {
	return btoa(
		bytes.reduce((acc, current) => acc + String.fromCharCode(current), ""),
	);
}

function utf8ToBase64(str: string): string {
	return encodeBase64Bytes(new TextEncoder().encode(str));
}

const template = ({
	topNotes,
	bottomNotes,
	code,
	expires,
	link,
	linkText,
}: {
	topNotes?: string[];
	bottomNotes?: string[];
	code?: string;
	expires?: string;
	link?: string;
	linkText?: string;
}) => `<!doctype html>
<html>
  <body>
    <div
      style='background-color:#060c1d;color:#FFFFFF;font-size:16px;font-weight:400;letter-spacing:0.15008px;line-height:1.5;margin:0;padding:32px 0;min-height:100%;width:100%'
    >
      <table
        align="center"
        width="100%"
        style="margin:0 auto;max-width:600px;background-color:#020514;border-radius:20px;border: 1px solid #c9cbd066;"
        role="presentation"
        cellspacing="0"
        cellpadding="0"
        border="0"
      >
        <tbody>
          <tr style="width:100%">
            <td>
              <div style="padding:24px 24px 24px 24px;text-align:center">
                <img
                  alt="Tabletop Companion Logo"
                  src="https://tabletopcompanion.com/logo.svg"
                  height="120"
                  style="height:120px;outline:none;border:none;text-decoration:none;vertical-align:middle;display:inline-block;max-width:100%"
                />
              </div>
			  ${
					topNotes
						? topNotes
								.map(
									(note) => `
			  <div>
              <div
                style="color:#ffffff;font-size:16px;font-weight:normal;text-align:center;padding:16px 24px 16px 24px"
              >
                ${note}
              </div>
              `,
								)
								.join("")
						: ""
				}
              ${
								link
									? `
              <div style="text-align:center;padding:12px 24px 32px 24px">
                <a
                  href="${link}"
                  style="color:#000000;font-size:14px;font-weight:bold;background-color:#3abdf7;border-radius:4px;display:inline-block;padding:12px 20px;text-decoration:none"
                  target="_blank"
                  ><span
                    ><!--[if mso
                      ]><i
                        style="letter-spacing: 20px;mso-font-width:-100%;mso-text-raise:30"
                        hidden
                        >&nbsp;</i
                      ><!
                    [endif]--></span
                  ><span>${linkText || link}</span
                  ><span
                    ><!--[if mso
                      ]><i
                        style="letter-spacing: 20px;mso-font-width:-100%"
                        hidden
                        >&nbsp;</i
                      ><!
                    [endif]--></span
                  ></a
                >
              </div>`
									: ""
							}
              ${
								code
									? `
              <h1
                style='font-weight:bold;text-align:center;margin:0;font-family:"Nimbus Mono PS", "Courier New", "Cutive Mono", monospace;font-size:32px;padding:16px 24px 16px 24px'
              >
                ${code}
              </h1>
              `
									: ""
							}
              ${
								expires
									? `
              <div
                style="color:#868686;font-size:16px;font-weight:normal;text-align:center;padding:16px 24px 16px 24px"
              >
                ${expires}
              </div>
              `
									: ""
							}
			  ${
					bottomNotes
						? bottomNotes
								.map(
									(note) => `
			  <div>
              <div
                style="color:#ffffff;font-size:16px;font-weight:normal;text-align:center;padding:16px 24px 16px 24px"
              >
                ${note}
              </div>
              `,
								)
								.join("")
						: ""
				}
              <div
                style="color:#868686;font-size:14px;font-weight:normal;text-align:center;padding:16px 24px 16px 24px"
              >
                Problems? Just reply to this email.
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </body>
</html>`;
