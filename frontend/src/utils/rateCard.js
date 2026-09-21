/**
 * rateCard.js
 * Single source of truth for all Livetake service packages.
 * Used by:
 *   - Admin needs assessment tab (select packages discussed in meeting)
 *   - QuotationCreate (auto-populated from assessment)
 *   - Client inquiry display (show service category labels)
 */

export const SERVICE_LABELS = {
  liveStreaming:        'Multi-Camera Live Event Coverage & Livestreaming',
  documentation:       'Events Digital Documentation (Photography & Videography)',
  weddingDebut:        'Wedding, Debut & Birthday Photo/Video with Livestream',
  virtualLivestreaming:'Remote & Virtual Livestreaming',
};

export const RATE_CARD = [
  {
    group:    'Virtual Live Streaming',
    category: 'liveStreaming',
    packages: [
      {
        id:    'vls_basic',
        name:  'Virtual Live Streaming',
        price: 30000,
        tag:   '₱30,000 per Livestream',
        inclusions: [
          'Zoom Video Patch via Zoom Pinning (max 4 remote speakers)',
          'Skype Video patch via NDI (max 8 remote speakers)',
          'Stream and Playback Operators',
          'Desktop Streaming Setup',
          'High-Quality Recording and Streaming',
          '1 Remote Technical Dry Run/Practice',
        ],
        note: '*Additional ₱5,000 for office/client\'s place setup',
      },
      {
        id:    'vls_office',
        name:  'Virtual Live Streaming + Office/Client Setup',
        price: 35000,
        tag:   '₱35,000 (includes office setup)',
        inclusions: [
          'Zoom Video Patch via Zoom Pinning (max 4 remote speakers)',
          'Skype Video patch via NDI (max 8 remote speakers)',
          'Stream and Playback Operators',
          'Desktop Streaming Setup',
          'High-Quality Recording and Streaming',
          '1 Remote Technical Dry Run/Practice',
          'Office/Client\'s Place Setup',
        ],
      },
    ],
  },
  {
    group:    'Events Live Coverage & Streaming',
    category: 'liveStreaming',
    packages: [
      {
        id:    'elcs_a',
        name:  'Events Live Coverage & Streaming – Package A (2-Camera)',
        price: 30000,
        tag:   'Package A – 2 Camera Setup – ₱30,000',
        inclusions: [
          'Video Technical Director, Camera & Livestream Operator',
          'Sony Broadcast Camcorders (Sony PXW-X70 and Sony NX100)',
          'Desktop Streaming Setup with complete capture devices',
          'Isolated Camera Recording and High-Quality Stream Recording',
          'HD Production Switcher (Live feed-ready)',
          'Basic Internet – 1 unit 5G/4G WiFi Modem',
          'Hybrid Setup-ready (Zoom, Skype, or MS Teams Speakers)',
        ],
        note: '*Technical dry run on a separate day = 70% of package price. Up to 6 cameras (+₱10,000/camera).',
      },
      {
        id:    'elcs_b',
        name:  'Events Live Coverage & Streaming – Package B (3-Camera)',
        price: 40000,
        tag:   'Package B – 3 Camera Setup – ₱40,000',
        inclusions: [
          'Video Technical Director, Camera & Livestream Operator',
          'Sony Broadcast Camcorders (Sony PXW-X70 and Sony NX100)',
          'Desktop Streaming Setup with complete capture devices',
          'Isolated Camera Recording and High-Quality Stream Recording',
          'HD Production Switcher (Live feed-ready)',
          'Basic Internet – 1 unit 5G/4G WiFi Modem',
          'Hybrid Setup-ready (Zoom, Skype, or MS Teams Speakers)',
        ],
        note: '*Technical dry run on a separate day = 70% of package price.',
      },
      {
        id:    'elcs_c',
        name:  'Events Live Coverage & Streaming – Package C (4-Camera)',
        price: 50000,
        tag:   'Package C – 4 Camera Setup – ₱50,000',
        inclusions: [
          'Video Technical Director, Camera & Livestream Operator',
          'Sony Broadcast Camcorders (Sony PXW-X70 and Sony NX100)',
          'Desktop Streaming Setup with complete capture devices',
          'Isolated Camera Recording and High-Quality Stream Recording',
          'HD Production Switcher (Live feed-ready)',
          'Basic Internet – 1 unit 5G/4G WiFi Modem',
          'Hybrid Setup-ready (Zoom, Skype, or MS Teams Speakers)',
        ],
        note: '*Technical dry run on a separate day = 70% of package price.',
      },
    ],
  },
  {
    group:    'Digital Documentation',
    category: 'documentation',
    packages: [
      {
        id:    'digidoc',
        name:  'Digital Documentation (Photography and Videography)',
        price: 50000,
        tag:   '₱50,000 – Photo & Video Coverage with SDE',
        inclusions: [
          '2 Photographers',
          '2 Videographers',
          'Aerial/Drone Videos',
          'Same-Day Edit (SDE) Video',
          'Raw Photos, Raw Videos, and Edited Video (given on the day)',
        ],
      },
    ],
  },
  {
    group:    'AVP Production',
    category: 'videoProduction',
    packages: [
      {
        id:    'avp',
        name:  'AVP Production (Video Shoot and Edit)',
        price: 40000,
        tag:   '₱40,000 – Video Shoot & Edit',
        inclusions: [
          '2 Videographers',
          '1 Video Editor',
          'Aerial/Drone Videos',
          'Raw Videos and Edited Video',
        ],
      },
    ],
  },
  {
    group:    'Additional Services',
    category: null,
    packages: [
      { id: 'add_led',      name: 'P3 Indoor LED Wall (40 panels, customizable size)',                                          price: 30000, tag: '₱30,000', inclusions: ['40 Panels P3 Indoor LED Wall (customizable size)'] },
      { id: 'add_inet',     name: 'Internet Aggregator (5G & 4G Modems with outdoor antennas)',                                  price: 25000, tag: '₱25,000', inclusions: ['5G & 4G Modems with outdoor antennas'] },
      { id: 'add_chroma',   name: 'Chroma Key Setup (20×10ft green screen with studio lights)',                                  price: 10000, tag: '₱10,000', inclusions: ['20×10ft green screen with studio lights'] },
      { id: 'add_audio',    name: 'Livestream Basic Audio & Lights Setup (Studio Only)',                                         price: 10000, tag: '₱10,000', inclusions: ['Livestream Basic Audio & Lights Setup'] },
      { id: 'add_graphics', name: 'Livestream Graphics Package (title cards, lower thirds, overlays, stingers, split screens)', price: 7000,  tag: '₱7,000',  inclusions: ['Title cards', 'Lower thirds', 'Graphic overlays', 'Stingers', 'Split screens'] },
      { id: 'add_tv',       name: '55 Inch LED TV with Stand, Laptop and Operator',                                             price: 7000,  tag: '₱7,000',  inclusions: ['55-inch LED TV', 'Laptop', 'Dedicated Operator'] },
    ],
  },
];

// Flat map: id → full package object
export const PACKAGE_MAP = Object.fromEntries(
  RATE_CARD.flatMap(g => g.packages).map(p => [p.id, p])
);

// All packages as flat array
export const ALL_PACKAGES = RATE_CARD.flatMap(g => g.packages);
