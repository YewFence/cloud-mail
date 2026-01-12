
// 简单的 Quoted-Printable 编码实现
function quotedPrintableEncode(str) {
    if (!str) return '';
    const utf8Bytes = new TextEncoder().encode(str);
    let result = '';
    
    for (const byte of utf8Bytes) {
        if ((byte >= 33 && byte <= 126 && byte !== 61) || byte === 32 || byte === 9) {
            result += String.fromCharCode(byte);
        } else {
            const hex = byte.toString(16).toUpperCase().padStart(2, '0');
            result += '=' + hex;
        }
    }
    return result;
}

// RFC 2047 Header 编码 (=?UTF-8?B?...?=)
function encodeHeader(str) {
    if (!str) return '';
    if (/^[\x00-\x7F]*$/.test(str)) return str;
    const utf8Bytes = new TextEncoder().encode(str);
    const base64 = btoa(String.fromCharCode.apply(null, utf8Bytes));
    return `=?UTF-8?B?${base64}?=`;
}

function formatDate(dateStr) {
    if (!dateStr) return new Date().toUTCString();
    return new Date(dateStr).toUTCString();
}

function generateBoundary() {
    return '----=_NextPart_' + Math.random().toString(36).substring(2, 15) + '.' + Date.now();
}

// 获取文件的 Base64 内容
async function fetchAttachmentAsBase64(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch ${url}`);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = reader.result;
                // remove data:content/type;base64,
                const base64 = base64String.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (e) {
        console.error('Fetch attachment failed', e);
        return null;
    }
}

// 根据文件名获取 Content-Type
function getContentType(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const map = {
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'gif': 'image/gif',
        'pdf': 'application/pdf',
        'txt': 'text/plain',
        'html': 'text/html',
        'zip': 'application/zip',
        'doc': 'application/msword',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'xls': 'application/vnd.ms-excel',
        'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };
    return map[ext] || 'application/octet-stream';
}

export async function generateEmlContent(email, withAttachments = false) {
    const mixedBoundary = generateBoundary();
    const altBoundary = generateBoundary();
    const headers = [];
    
    // Headers
    let from = email.sendEmail;
    if (email.name) {
        from = `${encodeHeader(email.name)} <${email.sendEmail}>`;
    }
    headers.push(`From: ${from}`);
    
    try {
        const recipients = JSON.parse(email.recipient || '[]');
        const toList = recipients.map(r => {
            return r.name ? `${encodeHeader(r.name)} <${r.address}>` : r.address;
        });
        if (toList.length > 0) {
            headers.push(`To: ${toList.join(', ')}`);
        } else {
             headers.push(`To: ${email.toEmail || email.recipient}`);
        }
    } catch (e) {
        headers.push(`To: ${email.recipient}`);
    }
    
    headers.push(`Subject: ${encodeHeader(email.subject)}`);
    headers.push(`Date: ${formatDate(email.createTime)}`);
    headers.push('MIME-Version: 1.0');
    
    if (email.messageId) {
         headers.push(`Message-ID: ${email.messageId}`);
    }

    // Determine content type based on attachments
    const hasAttachments = withAttachments && email.attList && email.attList.length > 0;
    
    if (hasAttachments) {
        headers.push(`Content-Type: multipart/mixed;\r\n\tboundary="${mixedBoundary}"`);
    } else {
        headers.push(`Content-Type: multipart/alternative;\r\n\tboundary="${altBoundary}"`);
    }

    let emlBody = headers.join('\r\n') + '\r\n\r\n';
    
    // If mixed, start the first part (which is alternative)
    if (hasAttachments) {
        emlBody += `--${mixedBoundary}\r\n`;
        emlBody += `Content-Type: multipart/alternative;\r\n\tboundary="${altBoundary}"\r\n\r\n`;
    }
    
    // --- Alternative Part (Text + HTML) ---
    
    // Plain Text
    emlBody += `--${altBoundary}\r\n`;
    emlBody += 'Content-Type: text/plain; charset="UTF-8"\r\n';
    emlBody += 'Content-Transfer-Encoding: base64\r\n\r\n';
    
    const textContent = email.text || '';
    const utf8TextBytes = new TextEncoder().encode(textContent);
    const base64Text = btoa(String.fromCharCode.apply(null, utf8TextBytes));
    emlBody += base64Text.match(/.{1,76}/g)?.join('\r\n') || '';
    emlBody += '\r\n\r\n';
    
    // HTML Part
    emlBody += `--${altBoundary}\r\n`;
    emlBody += 'Content-Type: text/html; charset="UTF-8"\r\n';
    emlBody += 'Content-Transfer-Encoding: base64\r\n\r\n';
    
    const htmlContent = email.content || email.text || '';
    const utf8HtmlBytes = new TextEncoder().encode(htmlContent);
    const base64Html = btoa(String.fromCharCode.apply(null, utf8HtmlBytes));
    emlBody += base64Html.match(/.{1,76}/g)?.join('\r\n') || '';
    emlBody += '\r\n\r\n';
    
    emlBody += `--${altBoundary}--\r\n`;
    
    // --- End Alternative Part ---

    // --- Attachments Part ---
    if (hasAttachments) {
        for (const att of email.attList) {
            // 只处理非内嵌图片附件，或者全部处理？
            // 通常内嵌图片(cid)已经在HTML中引用了，但如果是 multipart/mixed 结构，
            // 标准做法是把所有附件都列在 mixed 部分，或者如果是 cid 引用，可以用 multipart/related (更复杂)
            // 这里为了通用性，采用 simple mixed attachment
            
            // 使用相对路径通过后端代理下载，避免跨域 CORS 问题
            // 假设 att.key 格式为 "attachments/..."
            const url = '/api/' + att.key;
            const base64Data = await fetchAttachmentAsBase64(url);
            
            if (base64Data) {
                emlBody += `\r\n--${mixedBoundary}\r\n`;
                emlBody += `Content-Type: ${getContentType(att.filename)}; name="${encodeHeader(att.filename)}"\r\n`;
                emlBody += `Content-Transfer-Encoding: base64\r\n`;
                emlBody += `Content-Disposition: attachment; filename="${encodeHeader(att.filename)}"\r\n\r\n`;
                
                emlBody += base64Data.match(/.{1,76}/g)?.join('\r\n') || '';
                emlBody += '\r\n';
            }
        }
        
        emlBody += `\r\n--${mixedBoundary}--\r\n`;
    }

    return emlBody;
}

export async function downloadEml(email, withAttachments = false) {
    try {
        const emlContent = await generateEmlContent(email, withAttachments);
        const blob = new Blob([emlContent], { type: 'message/rfc822' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        const filename = (email.subject || 'email').replace(/[/\\?%*:|"<>]/g, '_');
        link.download = `${filename}.eml`;
        
        document.body.appendChild(link);
        link.click();
        
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    } catch (e) {
        console.error('Download EML failed', e);
        throw e;
    }
}
