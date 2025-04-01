function copyCode(button) {
    const codeBlock = button.closest('.code-block-container').querySelector('.code-content');
    // Get the actual code content, excluding any highlight tags
    const preElement = codeBlock.querySelector('pre');
    const code = preElement ? preElement.textContent : codeBlock.textContent;
    const tooltip = button.querySelector('.tooltip');

    // Create a temporary textarea to copy the text
    const textarea = document.createElement('textarea');
    textarea.value = code.trim();
    document.body.appendChild(textarea);
    textarea.select();

    try {
        document.execCommand('copy');
        button.classList.add('copied');
        tooltip.textContent = 'Copied!';
        
        // Fallback to modern clipboard API if available
        if (navigator.clipboard) {
            navigator.clipboard.writeText(code.trim()).catch(() => {});
        }

        setTimeout(() => {
            button.classList.remove('copied');
            tooltip.textContent = '';
        }, 2000);
    } catch (err) {
        console.error('Failed to copy:', err);
        tooltip.textContent = 'Failed to copy';
        button.classList.add('copied');
        
        setTimeout(() => {
            button.classList.remove('copied');
            tooltip.textContent = '';
        }, 2000);
    } finally {
        document.body.removeChild(textarea);
    }
} 