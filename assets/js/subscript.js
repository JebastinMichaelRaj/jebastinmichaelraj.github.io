
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
    
        const name = document.getElementById('contact-name').value;
        const number = document.getElementById('contact-phone').value;
        const toEmail = "jebastinmichaelraj@gmail.com";
        const subject = document.getElementById('subject').value;
        const content = document.getElementById('contact-message').value;

        const formattedSubject = `${subject} - ${name} (${number})`;
        const mailtoLink = `mailto:${encodeURIComponent(toEmail)}?subject=${encodeURIComponent(formattedSubject)}&body=${encodeURIComponent(content)}`;
        window.location.href = mailtoLink;
        setTimeout(() => {
            location.reload();
        }, 3000);
        console.log("Send mail");

   
}
