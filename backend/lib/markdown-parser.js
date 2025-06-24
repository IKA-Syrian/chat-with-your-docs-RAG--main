/**
 * Simple markdown processing for Node.js environment
 * This processes markdown content and splits it into sections
 */

export function processMarkdown(content, maxSectionLength = 2500) {
    // Split by headings (lines starting with #)
    const lines = content.split('\n');
    const sections = [];
    let currentSection = '';
    let currentHeading;

    for (const line of lines) {
        // Check if line is a heading
        if (line.match(/^#+\s/)) {
            // Save previous section if it exists
            if (currentSection.trim()) {
                sections.push(...chunkSection(currentSection, currentHeading, maxSectionLength));
            }

            // Start new section
            currentHeading = line.replace(/^#+\s/, '').trim();
            currentSection = line + '\n';
        } else {
            currentSection += line + '\n';
        }
    }

    // Add the last section
    if (currentSection.trim()) {
        sections.push(...chunkSection(currentSection, currentHeading, maxSectionLength));
    }

    // If no headings were found, treat the entire content as one section
    if (sections.length === 0) {
        sections.push(...chunkSection(content, undefined, maxSectionLength));
    }

    return { sections };
}

function chunkSection(content, heading, maxSectionLength) {
    if (content.length <= maxSectionLength) {
        return [{
            content: content.trim(),
            heading,
        }];
    }

    // Chunk into smaller sections
    const numberChunks = Math.ceil(content.length / maxSectionLength);
    const chunkSize = Math.ceil(content.length / numberChunks);
    const chunks = [];

    for (let i = 0; i < numberChunks; i++) {
        const chunk = content.substring(i * chunkSize, (i + 1) * chunkSize);
        chunks.push({
            content: chunk.trim(),
            heading,
            part: i + 1,
            total: numberChunks,
        });
    }

    return chunks;
}
