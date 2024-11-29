
// Download Pdf
function cvDownload() {

    const pdfPath = 'ResumePdf/JebastinMichaelRaj_Resume.pdf';
    const anchor = document.createElement('a');

    anchor.href = pdfPath;
    anchor.download = 'JebastinMichaelRajResume.pdf';
    document.body.appendChild(anchor);
    anchor.click();

    document.body.removeChild(anchor);

    console.log("download it");
}

function sendEmail() {
    const toEmail = document.getElementById('contact-email').value;
    const subject = document.getElementById('subject').value;
    const content = document.getElementById('contact-message').value;

    if (!toEmail || !subject || !content) {
        alert("Please fill in all the fields.");
        return;
    }

    const mailtoLink = `mailto:${encodeURIComponent(toEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(content)}`;
    window.location.href = mailtoLink;

    console.log("Send mail");
}
