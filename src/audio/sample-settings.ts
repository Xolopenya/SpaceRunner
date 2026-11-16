/** Optional sampled collision layer; user gains, engine and score stay unchanged. */
export const SAMPLED_AUDIO=Object.freeze({
  path:'assets/collision-audio/',timeoutMs:6000,rate:22050,attack:.002,release:.025,
  rock:{highpass:100,hull:.12},metal:{highpass:130,hull:.12},station:{highpass:75,hull:.12},mine:{highpass:110,hull:.24},
  hullPan:.16,minePan:.35,panScale:.08,
  rockContactTexture:.65,rockFractureContact:.40,
});
