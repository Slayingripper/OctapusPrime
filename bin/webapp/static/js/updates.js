class UpdatesManager {
  constructor() {
    this.apiUrl = 'https://api.github.com/repos/Slayingripper/OctapusPrime/releases';
    this.maxReleases = 10;
    this.init();
  }

  init() {
    this.loadGitHubReleases();
  }

  async loadGitHubReleases() {
    const loadingElement = document.getElementById('loading');
    const releasesContainer = document.getElementById('releases-container');
    const fallbackContent = document.getElementById('fallback-content');

    try {
      const response = await fetch(this.apiUrl);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const releases = await response.json();
      
      // Hide loading
      loadingElement.style.display = 'none';

      if (releases.length === 0) {
        this.showFallback();
        return;
      }

      // Display releases
      releases.slice(0, this.maxReleases).forEach(release => {
        const releaseCard = this.createReleaseCard(release);
        releasesContainer.appendChild(releaseCard);
      });

    } catch (error) {
      console.error('Failed to load GitHub releases:', error);
      loadingElement.innerHTML = `
        <div class="error-message">
          <p>⚠️ Failed to load releases from GitHub</p>
          <p style="font-size: 0.9rem; margin-top: 10px;">Error: ${error.message}</p>
        </div>
      `;
      this.showFallback();
    }
  }

  createReleaseCard(release) {
    const card = document.createElement('div');
    card.className = 'release-card';

    const publishedDate = new Date(release.published_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const changes = this.parseReleaseBody(release.body);

    card.innerHTML = `
      <div class="release-header">
        <div>
          <h3 class="release-version">${release.name || release.tag_name}</h3>
          ${release.prerelease ? '<span class="release-tag pre-release">Pre-release</span>' : ''}
          ${release.draft ? '<span class="release-tag">Draft</span>' : ''}
        </div>
        <span class="release-date">${publishedDate}</span>
      </div>
      
      ${release.body ? `<div class="release-description">${this.formatReleaseDescription(release.body)}</div>` : ''}
      
      ${changes.length > 0 ? `
        <div class="release-changes">
          <h4 class="changes-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
            What's New
          </h4>
          <ul class="changes-list">
            ${changes.map(change => `<li>${change}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
      
      ${release.assets && release.assets.length > 0 ? `
        <div class="download-links">
          ${release.assets.map(asset => `
            <a href="${asset.browser_download_url}" class="download-btn" target="_blank">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
              </svg>
              ${asset.name}
            </a>
          `).join('')}
        </div>
      ` : ''}
      
      <div class="download-links" style="margin-top: 10px;">
        <a href="${release.html_url}" class="download-btn" target="_blank">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.2 11.39.6.11.82-.26.82-.58v-2.03c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.1-.75.08-.73.08-.73 1.21.09 1.85 1.25 1.85 1.25 1.08 1.85 2.83 1.31 3.52 1 .11-.78.42-1.31.77-1.61-2.67-.3-5.47-1.34-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23.96-.27 1.98-.4 3-.41 1.02.01 2.04.14 3 .41 2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.8 5.63-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.69.82.58C20.56 21.8 24 17.3 24 12 24 5.37 18.63 0 12 0z"/>
          </svg>
          View on GitHub
        </a>
      </div>
    `;

    return card;
  }

  parseReleaseBody(body) {
    if (!body) return [];
    
    // Extract bullet points, features, or numbered lists
    const lines = body.split('\n');
    const changes = [];
    
    for (let line of lines) {
      line = line.trim();
      // Match various list formats
      if (line.match(/^[-*+]\s+/) || line.match(/^\d+\.\s+/) || line.match(/^▸\s+/)) {
        changes.push(line.replace(/^[-*+▸]\s+|^\d+\.\s+/, ''));
      }
    }
    
    return changes.slice(0, 10); // Limit to 10 items
  }

  formatReleaseDescription(body) {
    if (!body) return '';
    
    // Basic markdown-like formatting
    return body
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code style="background: var(--tertiary-bg); padding: 2px 6px; border-radius: 4px;">$1</code>')
      .split('\n')
      .slice(0, 3) // First 3 lines only
      .join('<br>')
      .substring(0, 300) + (body.length > 300 ? '...' : '');
  }

  showFallback() {
    document.getElementById('fallback-content').style.display = 'block';
  }
}

// Initialize the updates manager when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new UpdatesManager();
});