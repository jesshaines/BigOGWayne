export const homepageConfig = {
  featuredRelease: {
    eyebrow: "Now Playing",
    releaseTitle: "Streetwise",
    platformLabel: "YouTube",
    story: "Stay Sharp. Move Smart. Survive Anywhere.",
    artwork: {
      src: "/assets/images/products/collections/streetwise/streetwise_no_small_text_transparent.png",
      alt: "Streetwise release artwork"
    },
    primaryPlatformId: "youtube",
    platforms: [
      {
        id: "youtube",
        label: "YouTube",
        url: "https://www.youtube.com/shorts/r-WLBdA25NE"
      },
      {
        id: "tiktok",
        label: "TikTok",
        url: "https://www.tiktok.com/@wayneherr1/video/7656502182987975950"
      },
      {
        id: "spotify",
        label: "Spotify",
        url: "https://open.spotify.com/track/3HAGDuUYAyEMGiXGpdrgUx?si=fef72fee85344164"
      }
    ],
    merchCta: {
      label: "REP BIG OG WAYNE",
      url: "/collections/streetwise"
    }
  },
  collections: [
    {
      id: "streetwise",
      name: "Streetwise",
      displayName: "Street<br/>wise",
      badge: "FEATURED RELEASE",
      story: "Built from real stories, sharp instincts, and the current era.",
      url: "/collections/streetwise",
      artwork: {
        src: "/assets/images/products/collections/streetwise/streetwise_textonly.png",
        alt: "Streetwise"
      },
      artFallback: "SW",
      colorClass: "col-3",
      isFeatured: true
    },
    {
      id: "no-bluff",
      name: "No Bluff",
      displayName: "No<br/>Bluff",
      badge: "SIGNATURE SERIES",
      story: "Direct, grounded, and made for the ones who recognize the truth in the music.",
      url: "/collections/no-bluff",
      artwork: {
        src: "/assets/images/logo/NoBluff_Logo_BlackBkg.png",
        alt: "No Bluff"
      },
      artFallback: "NB",
      colorClass: "col-2"
    },
    {
      id: "stinky-pinky",
      name: "Stinky Pinky",
      displayName: "Stinky<br/>Pinky",
      badge: "FAN FAVORITE",
      story: "A fan-favorite release that keeps the older Big OG Wayne energy alive.",
      url: "/collections/stinky-pinky",
      artwork: {
        src: "/assets/images/logo/StinkyPinky_Logo_Blackbkg.png",
        alt: "Stinky Pinky"
      },
      artFallback: "SP",
      colorClass: "col-1"
    }
  ]
};
