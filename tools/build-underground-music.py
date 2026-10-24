"""
The music of the caves, dungeons and ruins (public/music/underground.mp3): a slow drone in D minor
under a shifting pad, far-off bells from the pentatonic, and water dripping somewhere in the dark,
with a long echo. Synthesised here (numpy), so it loops seamlessly.

    python tools/build-underground-music.py
"""
import os
import subprocess
import numpy as np

SR = 44100
LEN = 96.0
rng = np.random.default_rng(7)
n = int(SR * LEN)
t = np.arange(n) / SR
out = np.zeros(n)


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


# The drone: D and A, breathing slowly.
for m, g in ((38, 0.20), (45, 0.12), (50, 0.06)):
    f = hz(m)
    lfo = 0.75 + 0.25 * np.sin(2 * np.pi * t / (17 + m % 5) + m)
    out += g * lfo * (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * 2 * f * t + 0.5))

# The pad: Dm - Bb - Gm - A, each twelve seconds, crossfading.
chords = [(62, 65, 69), (58, 62, 65), (55, 58, 62), (57, 61, 64)]
seg = 12.0
pad = np.zeros(n)
for k in range(int(LEN / seg)):
    ch = chords[k % 4]
    s0 = int(k * seg * SR)
    s1 = min(n, int((k + 1) * seg * SR + 2 * SR))
    tt = np.arange(s1 - s0) / SR
    env = np.minimum(1, tt / 3) * np.minimum(1, (len(tt) / SR - tt) / 3)
    v = np.zeros(len(tt))
    for m in ch:
        for det in (-0.08, 0.08):
            v += np.sin(2 * np.pi * hz(m - 12) * (1 + det / 100) * tt) * 0.5 + 0.18 * np.sin(2 * np.pi * hz(m) * (1 + det / 100) * tt)
    pad[s0:s1] += 0.035 * v * env
out += pad

# Bells, far off: D minor pentatonic, a few each phrase.
scale = [74, 77, 79, 81, 84, 86]
when = 1.5
while when < LEN - 4:
    m = scale[rng.integers(len(scale))]
    f = hz(m)
    s0 = int(when * SR)
    tt = np.arange(int(4 * SR)) / SR
    env = np.exp(-tt * 1.4)
    b = (np.sin(2 * np.pi * f * tt) + 0.35 * np.sin(2 * np.pi * f * 2.76 * tt) * np.exp(-tt * 3)) * env
    out[s0:s0 + len(b)] += 0.05 * b[: n - s0]
    when += rng.uniform(2.5, 6.0)

# Drips: tiny falling chirps.
when = 0.7
while when < LEN - 1:
    s0 = int(when * SR)
    tt = np.arange(int(0.12 * SR)) / SR
    f = rng.uniform(1400, 2600)
    d = np.sin(2 * np.pi * (f * tt - 3000 * tt * tt)) * np.exp(-tt * 45)
    out[s0:s0 + len(d)] += 0.06 * d
    when += rng.uniform(0.8, 3.5)

# A low wind of filtered noise.
noise = rng.standard_normal(n)
wind = np.convolve(noise, np.ones(400) / 400, mode='same')
wind *= 0.6 + 0.4 * np.sin(2 * np.pi * t / 23)
out += 0.25 * wind

# A long echo (the cave).
for delay, g in ((0.37, 0.35), (0.81, 0.22), (1.43, 0.14)):
    d = int(delay * SR)
    out[d:] += g * out[:-d]

# Seamless loop: the last four seconds fold into the first four.
x = int(4 * SR)
fade = np.linspace(0, 1, x)
out[:x] = out[:x] * fade + out[-x:] * (1 - fade)
out = out[:-x]
out /= np.max(np.abs(out)) * 1.15

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
wav = os.path.join(root, 'tools', '_underground.wav')
import wave
with wave.open(wav, 'wb') as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((out * 32767).astype(np.int16).tobytes())
import imageio_ffmpeg
subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), '-y', '-loglevel', 'error', '-i', wav, '-b:a', '96k', os.path.join(root, 'public', 'music', 'underground.mp3')], check=True)
os.remove(wav)
print('ok')
