
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

const latin1Decoder = new TextDecoder('latin1');

function bytesToBase64(bytes) {
    return btoa(latin1Decoder.decode(bytes));
}

function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// RFC 2047 Header 编码 (=?UTF-8?B?...?=)
function encodeHeader(str) {
    if (!str) return '';
    if (/^[\x00-\x7F]*$/.test(str)) return str;
    const utf8Bytes = new TextEncoder().encode(str);
    const base64 = bytesToBase64(utf8Bytes);
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

export async function generateEmlContent(email, withAttachments = false, onProgress) {
    const mixedBoundary = generateBoundary();
    const altBoundary = generateBoundary();
    const headers = [];
    const parts = [];
    
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

    // Prepare content (append attachment links if not downloading attachments)
    let textContent = email.text || '';
    let htmlContent = email.content || email.text || '';

    if (!withAttachments && email.attList && email.attList.length > 0) {
        const baseUrl = window.location.origin;
        
        // Append to Text
        textContent += '\n\n----------------------------\nAttachments:\n';
        
        // Append to HTML
        htmlContent += '<br/><hr/><h3>Attachments:</h3><ul>';
        
        for (const att of email.attList) {
            // Encode filename for URL to ensure valid link
            const attUrl = `${baseUrl}/api/${att.key}`;
            
            // Text
            textContent += `- ${att.filename}: ${attUrl}\n`;
            
            // HTML
            htmlContent += `<li><a href="${attUrl}" target="_blank">${escapeHtml(att.filename)}</a></li>`;
        }
        
        htmlContent += '</ul>';
    }
    
    if (hasAttachments) {
        headers.push(`Content-Type: multipart/mixed;\r\n\tboundary="${mixedBoundary}"`);
    } else {
        headers.push(`Content-Type: multipart/alternative;\r\n\tboundary="${altBoundary}"`);
    }

    parts.push(headers.join('\r\n') + '\r\n\r\n');
    
    // If mixed, start the first part (which is alternative)
    if (hasAttachments) {
        parts.push(`--${mixedBoundary}\r\n`);
        parts.push(`Content-Type: multipart/alternative;\r\n\tboundary="${altBoundary}"\r\n\r\n`);
    }
    
    // --- Alternative Part (Text + HTML) ---
    
    // Plain Text
    parts.push(`--${altBoundary}\r\n`);
    parts.push('Content-Type: text/plain; charset="UTF-8"\r\n');
    parts.push('Content-Transfer-Encoding: base64\r\n\r\n');
    
    const utf8TextBytes = new TextEncoder().encode(textContent);
    const base64Text = bytesToBase64(utf8TextBytes);
    parts.push(base64Text.match(/.{1,76}/g)?.join('\r\n') || '');
    parts.push('\r\n\r\n');
    
    // HTML Part
    parts.push(`--${altBoundary}\r\n`);
    parts.push('Content-Type: text/html; charset="UTF-8"\r\n');
    parts.push('Content-Transfer-Encoding: base64\r\n\r\n');
    
    const utf8HtmlBytes = new TextEncoder().encode(htmlContent);
    const base64Html = bytesToBase64(utf8HtmlBytes);
    parts.push(base64Html.match(/.{1,76}/g)?.join('\r\n') || '');
    parts.push('\r\n\r\n');
    
    parts.push(`--${altBoundary}--\r\n`);
    
    // --- End Alternative Part ---

    // --- Attachments Part ---
    let failedCount = 0;
    if (hasAttachments) {
        let processedCount = 0;
        const totalCount = email.attList.length;

        for (const att of email.attList) {
            // 使用相对路径通过后端代理下载，避免跨域 CORS 问题
            const url = '/api/' + att.key;
            const base64Data = await fetchAttachmentAsBase64(url);
            
            parts.push(`\r\n--${mixedBoundary}\r\n`);
            
            if (base64Data) {
                parts.push(`Content-Type: ${getContentType(att.filename)}; name="${encodeHeader(att.filename)}"\r\n`);
                parts.push(`Content-Transfer-Encoding: base64\r\n`);
                parts.push(`Content-Disposition: attachment; filename="${encodeHeader(att.filename)}"\r\n\r\n`);
                
                parts.push(base64Data.match(/.{1,76}/g)?.join('\r\n') || '');
            } else {
                console.error(`Failed to download attachment: ${att.filename} (key: ${att.key}). substituting with placeholder.`);
                failedCount++;
                // Handle failed download with a text placeholder
                const errorMsg = `Failed to download attachment: ${att.filename}`;
                const errorFilename = `${att.filename}.error.txt`;
                
                parts.push(`Content-Type: text/plain; charset="UTF-8"; name="${encodeHeader(errorFilename)}"\r\n`);
                parts.push(`Content-Transfer-Encoding: base64\r\n`);
                parts.push(`Content-Disposition: attachment; filename="${encodeHeader(errorFilename)}"\r\n\r\n`);
                
                const utf8Bytes = new TextEncoder().encode(errorMsg);
                const base64Error = bytesToBase64(utf8Bytes);
                parts.push(base64Error);
            }
            parts.push('\r\n');
            
            processedCount++;
            if (onProgress) {
                onProgress(Math.round((processedCount / totalCount) * 100));
            }
        }
        
        parts.push(`\r\n--${mixedBoundary}--\r\n`);
    } else if (onProgress) {
        onProgress(100);
    }

    return {
        blob: new Blob(parts, { type: 'message/rfc822' }),
        failedCount
    };
}

export async function downloadEml(email, withAttachments = false, onProgress) {
    try {
        const { blob, failedCount } = await generateEmlContent(email, withAttachments, onProgress);
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        const filename = (email.subject || 'email').replace(/[/\\?%*:|"<>]/g, '_');
        link.download = `${filename}.eml`;
        
        document.body.appendChild(link);
        link.click();
        
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        return failedCount;
    } catch (e) {
        console.error('Download EML failed', e);
        throw e;
    }
}
