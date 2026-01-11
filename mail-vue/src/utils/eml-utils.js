
// 简单的 Quoted-Printable 编码实现
function quotedPrintableEncode(str) {
    if (!str) return '';
    // 将字符串转换为 UTF-8 字节数组
    const utf8Bytes = new TextEncoder().encode(str);
    let result = '';
    
    for (const byte of utf8Bytes) {
        // 可打印 ASCII 字符 (除了 =)
        if ((byte >= 33 && byte <= 126 && byte !== 61) || byte === 32 || byte === 9) {
            result += String.fromCharCode(byte);
        } else {
            // 需要编码的字符
            const hex = byte.toString(16).toUpperCase().padStart(2, '0');
            result += '=' + hex;
        }
    }
    
    // 处理行长限制 (76 字符) - 简化处理，每 75 字符强制换行
    // 注意：标准的 QP 编码换行需要是 =\r\n
    // 这里简单实现，对于邮件正文通常浏览器/客户端能容错
    // 为了更标准，可以引入专门的库，但为了减少依赖，这里做一个基础实现
    // 如果是 header，通常直接使用 base64 编码 (RFC 2047)
    return result;
}

// RFC 2047 Header 编码 (=?UTF-8?B?...?=)
function encodeHeader(str) {
    if (!str) return '';
    // 如果全是 ASCII，不需要编码
    if (/^[\x00-\x7F]*$/.test(str)) return str;
    
    // 使用 Base64 编码
    // 注意：浏览器环境 btoa 需要处理 UTF-8 字符串
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

export function generateEmlContent(email) {
    const boundary = generateBoundary();
    const headers = [];
    
    // From
    let from = email.sendEmail;
    if (email.name) {
        from = `${encodeHeader(email.name)} <${email.sendEmail}>`;
    }
    headers.push(`From: ${from}`);
    
    // To
    // recipient 是 JSON 字符串 [{"address":"...","name":"..."}]
    try {
        const recipients = JSON.parse(email.recipient || '[]');
        const toList = recipients.map(r => {
            return r.name ? `${encodeHeader(r.name)} <${r.address}>` : r.address;
        });
        if (toList.length > 0) {
            headers.push(`To: ${toList.join(', ')}`);
        } else {
            // 如果解析失败或为空，尝试使用 toEmail
             headers.push(`To: ${email.toEmail || email.recipient}`);
        }
    } catch (e) {
        headers.push(`To: ${email.recipient}`);
    }
    
    // Subject
    headers.push(`Subject: ${encodeHeader(email.subject)}`);
    
    // Date
    headers.push(`Date: ${formatDate(email.createTime)}`);
    
    // MIME-Version
    headers.push('MIME-Version: 1.0');
    
    // Content-Type
    headers.push(`Content-Type: multipart/alternative;\r\n\tboundary="${boundary}"`);
    
    // Message-ID
    if (email.messageId) {
         headers.push(`Message-ID: ${email.messageId}`);
    }

    let emlBody = headers.join('\r\n') + '\r\n\r\n';
    
    // Plain Text Part
    emlBody += `--${boundary}\r\n`;
    emlBody += 'Content-Type: text/plain; charset="UTF-8"\r\n';
    emlBody += 'Content-Transfer-Encoding: base64\r\n\r\n';
    
    // 使用 Base64 编码正文，比 QP 编码更简单可靠且不容易出乱码
    const textContent = email.text || '';
    const utf8TextBytes = new TextEncoder().encode(textContent);
    const base64Text = btoa(String.fromCharCode.apply(null, utf8TextBytes));
    // Base64 需要折行，每 76 字符换行
    emlBody += base64Text.match(/.{1,76}/g)?.join('\r\n') || '';
    emlBody += '\r\n\r\n';
    
    // HTML Part
    emlBody += `--${boundary}\r\n`;
    emlBody += 'Content-Type: text/html; charset="UTF-8"\r\n';
    emlBody += 'Content-Transfer-Encoding: base64\r\n\r\n';
    
    const htmlContent = email.content || email.text || '';
    // 简单处理 html 中的图片链接，确保是绝对路径（如果需要）
    // 目前系统中图片可能是 {{domain}}/key 的形式，在生成 EML 时最好替换为实际链接，以便客户端能加载
    // 但这个工具函数里可能拿不到 domain 配置。
    // 如果 email 对象里的 content 已经是处理过的（例如在 view 中 formatImage 之后的），那就最好。
    // 这里假设传入的 email.content 是原始数据或已处理数据。
    
    const utf8HtmlBytes = new TextEncoder().encode(htmlContent);
    const base64Html = btoa(String.fromCharCode.apply(null, utf8HtmlBytes));
    emlBody += base64Html.match(/.{1,76}/g)?.join('\r\n') || '';
    emlBody += '\r\n\r\n';
    
    // End Boundary
    emlBody += `--${boundary}--\r\n`;
    
    return emlBody;
}

export function downloadEml(email) {
    try {
        const emlContent = generateEmlContent(email);
        const blob = new Blob([emlContent], { type: 'message/rfc822' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        // 文件名处理，替换非法字符
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
