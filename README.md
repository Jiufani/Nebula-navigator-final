Project Option
Simple Browser Game

Project Description
Nebula Navigator is a 2D browser-based survival game where players pilot a spacecraft through an asteroid field while managing limited fuel. Survive for 60 seconds to activate the Warp Gate and escape. Players earn points by passing asteroids, with a score multiplier increasing as difficulty rises. A local high-score system saves personal bests.

Theme Interpretation
The game fully embraces a space theme with a scrolling starfield, procedurally generated asteroid fields, neon visuals, and a warp gate escape sequence. The HUD reinforces immersion with spacecraft-themed labels like Fuel and Warp Sync.

Intended User
Designed for students and casual gamers, the game runs on any modern desktop or mobile browser with no installation or account required. Each session lasts about one minute for quick, accessible gameplay.

Player Goal
Survive for 60 seconds without colliding with asteroids or running out of fuel. Players can also aim for a higher score and beat their stored high score.

Main Features
Procedurally generated asteroid field with increasing difficulty.
Fuel system that rewards efficient movement.
Score multiplier based on difficulty level.
Animated Warp Gate win sequence.
HUD displaying fuel, timer, level, and score.
Level-up visual effects.
Local high-score saving.
Responsive design with touch controls.
Credits screen.
JavaScript Features
Canvas game loop using requestAnimationFrame.
Collision detection between ship and asteroids.
Fuel and difficulty management that updates throughout gameplay.
Particle effects for engine trails and explosions.
Screen management for title, gameplay, win, lose, instructions, and credits.
Shared keyboard and touch input handling.
Responsive Design

The game scales to different screen sizes using a responsive canvas, CSS media queries, and clamp(). Touch controls appear on smaller screens, while keyboard controls are used on desktops. Accessibility includes support for reduced-motion preferences.

User Testing
Testing with peers revealed several improvements needed:

Ship could hide behind the HUD.
Fuel wasn't meaningful.
Warp sequence looked like a freeze.
Window resizing affected gameplay.
Players wanted clearer low-fuel warnings.

Revisions
Prevented the ship from entering the HUD area.
Rebalanced fuel consumption.
Added a dedicated warp animation.
Added pulsing low-fuel warnings.
Made the timer turn red during the final 10 seconds.

Technologies Used
HTML
CSS
JavaScript
GitHub Pages

Credits
Orbitron font (Google Fonts)
HTML5 Canvas API
Web Storage API (localStorage)
Inspired by classic arcade dodge games

Future Improvements
Power-ups
Sound effects and music
Online leaderboard
More asteroid types
Difficulty selection
Improved mobile controls
