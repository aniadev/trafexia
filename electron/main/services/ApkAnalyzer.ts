import AdmZip from 'adm-zip';

export class ApkAnalyzer {
  constructor() {}

  async analyze(filePath: string): Promise<string[]> {
    console.log('[ApkAnalyzer] Analyzing file (APK/XAPK):', filePath);
    const urls = new Set<string>();
    
    try {
      const zip = new AdmZip(filePath);
      await this.processZip(zip, urls);
    } catch (err) {
      console.error('[ApkAnalyzer] Error:', err);
      throw err;
    }

    return Array.from(urls).sort();
  }

  private async processZip(zip: AdmZip, urls: Set<string>) {
    const zipEntries = zip.getEntries();
    const urlRegex = /https?:\/\/[a-zA-Z0-9\-\._~:\/?#[\]@!$&'()*+,;=%]+/g;

    for (const entry of zipEntries) {
      if (entry.isDirectory) continue;
      
      const name = entry.entryName.toLowerCase();
      
      // If it's a nested APK (common in XAPK or APKS), recurse!
      if (name.endsWith('.apk')) {
        try {
          // Flatten nested APKs by reading into memory and re-parsing as Zip
          const nestedBuffer = entry.getData();
          const nestedZip = new AdmZip(nestedBuffer);
          await this.processZip(nestedZip, urls);
        } catch (e) {
          console.warn('[ApkAnalyzer] Failed to process nested APK:', name);
        }
        continue;
      }

      // Standard interesting files
      const shouldScan = name.endsWith('.dex') || 
                         name.endsWith('.arsc') || 
                         name.endsWith('.xml') || 
                         name.endsWith('.so') ||
                         name.endsWith('.js') || 
                         name.endsWith('.json');

      if (shouldScan) {
        try {
          const buffer = entry.getData();
          // Convert buffer to string. Binary safe-ish.
          // For massive files (like large .so), this might be slow, but essential.
          const content = buffer.toString('binary'); 
          
          let match;
          while ((match = urlRegex.exec(content)) !== null) {
            let url = match[0];
            if (this.isValidUrl(url)) {
              urls.add(url);
            }
          }
        } catch (e) {
          console.warn('[ApkAnalyzer] Failed to read entry:', name);
        }
      }
    }
  }

  private isValidUrl(url: string): boolean {
    // 1. Basic Filters
    if (url.length < 10) return false;
    if (!url.includes('.')) return false;
    if (/[<>{}\\^`\s]/.test(url)) return false; // No spaces or weird chars

    // 2. Domain Blacklist (Trackers, Ads, Infrastructure, Default Android)
    const domainBlacklist = [
      'schemas.android.com',
      'www.w3.org',
      'xml.org',
      'example.com',
      'google.com/android',
      'apache.org',
      'github.com',
      'googlesyndication.com',
      'doubleclick.net',
      'facebook.com',
      'google-analytics.com',
      'adjust.io',
      'appsflyer.com',
      'crashlytics.com',
      'googleapis.com',
      'googleadservices.com',
      'googletagmanager.com',
      'facebook.net',
      'twitter.com',
      'linkedin.com',
      'instagram.com',
      'pinterest.com',
      'youtube.com',
      'youtu.be',
      'play.google.com',
      'support.google.com',
      'policies.google.com',
      'developer.android.com',
      'android.googlesource.com',
      'unity3d.com',
      'unity.com',
      'adobe.com',
      'macromedia.com',
      'microsoft.com',
      'apple.com',
      'schema.org',
      'xmlns.com',
      'gstatic.com',
      'g.co',
      'goo.gl',
      'bit.ly',
      'aka.ms',
      'amzn.to' // Shorteners often used in generic help links
    ];

    if (domainBlacklist.some(d => url.includes(d))) return false;

    // Filter out localhost unless specifically allowed (usually internal test/debug)
    if (url.includes('localhost') || url.includes('127.0.0.1')) return false;


    // 3. Extension Blacklist (Static Assets)
    const lower = url.toLowerCase();
    const assetExtensions = [
      '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico',
      '.ttf', '.otf', '.woff', '.woff2', '.eot',
      '.css', '.html', '.js', '.json', '.xml', // Usually static config/web views
      '.mp3', '.mp4', '.wav', '.mov',
      '.zip', '.pdf', '.apk'
    ];

    if (assetExtensions.some(ext => lower.endsWith(ext))) return false;

    // 4. "Quality" Heuristics
    // Use heuristic to favor "API-like" URLs (api, v1, v2, graphql, service, etc)
    // But don't strictly filter *only* them, just ensure we removed the noise.
    // The blacklists above should handle 90% of noise.

    return true;
  }
}
