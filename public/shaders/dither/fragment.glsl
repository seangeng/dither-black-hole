uniform sampler2D tDiffuse;
uniform vec2 resolution;
uniform float gridSize;
uniform float intensity;
uniform float time;
uniform vec3 backgroundColor;
uniform float contrast;

varying vec2 vUv;

// 4x4 Bayer matrix for ordered dithering
float getBayerValue(vec2 pos) {
  vec2 pixel = floor(mod(pos, 4.0));
  int x = int(pixel.x);
  int y = int(pixel.y);
  
  // 4x4 Bayer matrix (normalized to 0-1)
  if (x == 0) {
    if (y == 0) return 0.0 / 16.0;
    if (y == 1) return 8.0 / 16.0;
    if (y == 2) return 2.0 / 16.0;
    return 10.0 / 16.0; // y == 3
  } 
  else if (x == 1) {
    if (y == 0) return 12.0 / 16.0;
    if (y == 1) return 4.0 / 16.0;
    if (y == 2) return 14.0 / 16.0;
    return 6.0 / 16.0; // y == 3
  }
  else if (x == 2) {
    if (y == 0) return 3.0 / 16.0;
    if (y == 1) return 11.0 / 16.0;
    if (y == 2) return 1.0 / 16.0;
    return 9.0 / 16.0; // y == 3
  }
  else { // x == 3
    if (y == 0) return 15.0 / 16.0;
    if (y == 1) return 7.0 / 16.0;
    if (y == 2) return 13.0 / 16.0;
    return 5.0 / 16.0; // y == 3
  }
}

void main() {
  vec2 fragCoord = vUv * resolution;
  
  // Sample the original color
  vec4 originalColor = texture2D(tDiffuse, vUv);
  
  // Apply pixelation effect
  float pixelSize = gridSize;
  vec2 pixelatedCoord = floor(fragCoord / pixelSize) * pixelSize;
  vec2 pixelatedUV = pixelatedCoord / resolution;
  vec4 pixelatedColor = texture2D(tDiffuse, pixelatedUV);
  
  // Convert to grayscale/luminance and apply contrast
  float luminance = dot(pixelatedColor.rgb, vec3(0.299, 0.587, 0.114));
  
  // Enhance contrast to make orbital areas more prominent
  luminance = pow(luminance, 1.0 / contrast);
  luminance = clamp(luminance, 0.0, 1.0);
  
  // Get Bayer matrix value for dithering
  float bayerValue = getBayerValue(pixelatedCoord / pixelSize);
  
  // Add subtle animation to the dither pattern
  float timeOffset = sin(time * 0.2 + pixelatedCoord.x * 0.01 + pixelatedCoord.y * 0.01) * 0.03;
  bayerValue = clamp(bayerValue + timeOffset, 0.0, 1.0);
  
  // Create high-contrast dithering threshold
  float ditherThreshold = bayerValue;
  
  // Determine if pixel should be bright or dark based on luminance vs threshold
  vec3 finalColor;
  
  if (luminance > 0.02) {
    // Apply dithering: compare luminance to threshold
    if (luminance > ditherThreshold * intensity + (1.0 - intensity)) {
      // Bright pixel - make it white/bright
      finalColor = vec3(1.0);
    } else {
      // Dark pixel in dither pattern
      finalColor = backgroundColor;
    }
  } else {
    // Pure black background areas
    finalColor = backgroundColor;
  }
  
  // For very bright areas (like the accretion disc), ensure they stay mostly white
  if (luminance > 0.8) {
    float brightArea = smoothstep(0.8, 1.0, luminance);
    finalColor = mix(finalColor, vec3(1.0), brightArea * 0.7);
  }
  
  gl_FragColor = vec4(finalColor, originalColor.a);
}
