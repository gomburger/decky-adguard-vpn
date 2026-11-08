"""Minimal QR Code encoder: byte mode, error correction level M, versions 1-40.

Small enough to ship with the plugin so the login link can be scanned with a phone.
Follows ISO/IEC 18004 (structure after Project Nayuki's reference encoder).

Copyright (c) 2026 gomburger. MIT License.
Based on the structure of Project Nayuki's QR Code generator library,
Copyright (c) Project Nayuki, MIT License. See LICENSE for both notices.
"""

# Error correction level M only.
_ECC_PER_BLOCK = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26,
                  26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28]
_NUM_BLOCKS = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16,
               17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49]
_ECL_FORMAT_BITS = 0  # M


def _bit(value, i):
    return (value >> i) & 1 != 0


def _raw_modules(ver):
    result = (16 * ver + 128) * ver + 64
    if ver >= 2:
        align = ver // 7 + 2
        result -= (25 * align - 10) * align - 55
        if ver >= 7:
            result -= 36
    return result


def _data_codewords(ver):
    return _raw_modules(ver) // 8 - _ECC_PER_BLOCK[ver] * _NUM_BLOCKS[ver]


def _gf_mul(x, y):
    z = 0
    for i in reversed(range(8)):
        z = (z << 1) ^ ((z >> 7) * 0x11D)
        z ^= ((y >> i) & 1) * x
    return z


def _rs_divisor(degree):
    result = [0] * (degree - 1) + [1]
    root = 1
    for _ in range(degree):
        for j in range(degree):
            result[j] = _gf_mul(result[j], root)
            if j + 1 < degree:
                result[j] ^= result[j + 1]
        root = _gf_mul(root, 0x02)
    return result


def _rs_remainder(data, divisor):
    result = [0] * len(divisor)
    for b in data:
        factor = b ^ result.pop(0)
        result.append(0)
        for i, coef in enumerate(divisor):
            result[i] ^= _gf_mul(coef, factor)
    return result


def _encode_data(payload):
    for ver in range(1, 41):
        count_bits = 8 if ver <= 9 else 16
        capacity = _data_codewords(ver) * 8
        if 4 + count_bits + len(payload) * 8 <= capacity:
            break
    else:
        raise ValueError("data too long for a QR code")
    bits = []

    def put(value, length):
        bits.extend((value >> i) & 1 for i in reversed(range(length)))

    put(0b0100, 4)
    put(len(payload), count_bits)
    for b in payload:
        put(b, 8)
    put(0, min(4, capacity - len(bits)))
    put(0, -len(bits) % 8)
    pad = 0xEC
    while len(bits) < capacity:
        put(pad, 8)
        pad ^= 0xEC ^ 0x11
    codewords = [int("".join(map(str, bits[i:i + 8])), 2) for i in range(0, len(bits), 8)]
    return ver, codewords


def _add_ecc_and_interleave(ver, data):
    num_blocks = _NUM_BLOCKS[ver]
    ecc_len = _ECC_PER_BLOCK[ver]
    raw_codewords = _raw_modules(ver) // 8
    num_short = num_blocks - raw_codewords % num_blocks
    short_len = raw_codewords // num_blocks
    divisor = _rs_divisor(ecc_len)
    blocks = []
    k = 0
    for i in range(num_blocks):
        size = short_len - ecc_len + (0 if i < num_short else 1)
        dat = data[k:k + size]
        k += size
        ecc = _rs_remainder(dat, divisor)
        if i < num_short:
            dat = dat + [0]
        blocks.append(dat + ecc)
    result = []
    for i in range(len(blocks[0])):
        for j, block in enumerate(blocks):
            if i != short_len - ecc_len or j >= num_short:
                result.append(block[i])
    return result


class _Grid:
    def __init__(self, ver):
        self.ver = ver
        self.size = ver * 4 + 17
        self.dark = [[False] * self.size for _ in range(self.size)]
        self.fixed = [[False] * self.size for _ in range(self.size)]

    def set_fixed(self, x, y, dark):
        self.dark[y][x] = dark
        self.fixed[y][x] = True

    def draw_function_patterns(self):
        n = self.size
        for i in range(n):
            self.set_fixed(6, i, i % 2 == 0)
            self.set_fixed(i, 6, i % 2 == 0)
        for cx, cy in ((3, 3), (n - 4, 3), (3, n - 4)):
            for dy in range(-4, 5):
                for dx in range(-4, 5):
                    x, y = cx + dx, cy + dy
                    if 0 <= x < n and 0 <= y < n:
                        self.set_fixed(x, y, max(abs(dx), abs(dy)) not in (2, 4))
        positions = self.alignment_positions()
        last = len(positions) - 1
        for i, px in enumerate(positions):
            for j, py in enumerate(positions):
                if (i, j) in ((0, 0), (0, last), (last, 0)):
                    continue
                for dy in range(-2, 3):
                    for dx in range(-2, 3):
                        self.set_fixed(px + dx, py + dy, max(abs(dx), abs(dy)) != 1)
        self.draw_format_bits(0)
        self.draw_version()

    def alignment_positions(self):
        if self.ver == 1:
            return []
        align = self.ver // 7 + 2
        step = (self.ver * 8 + align * 3 + 5) // (align * 4 - 4) * 2
        result = [self.size - 7 - i * step for i in range(align - 1)] + [6]
        return list(reversed(result))

    def draw_format_bits(self, mask):
        data = _ECL_FORMAT_BITS << 3 | mask
        rem = data
        for _ in range(10):
            rem = (rem << 1) ^ ((rem >> 9) * 0x537)
        bits = (data << 10 | rem) ^ 0x5412
        n = self.size
        for i in range(6):
            self.set_fixed(8, i, _bit(bits, i))
        self.set_fixed(8, 7, _bit(bits, 6))
        self.set_fixed(8, 8, _bit(bits, 7))
        self.set_fixed(7, 8, _bit(bits, 8))
        for i in range(9, 15):
            self.set_fixed(14 - i, 8, _bit(bits, i))
        for i in range(8):
            self.set_fixed(n - 1 - i, 8, _bit(bits, i))
        for i in range(8, 15):
            self.set_fixed(8, n - 15 + i, _bit(bits, i))
        self.set_fixed(8, n - 8, True)

    def draw_version(self):
        if self.ver < 7:
            return
        rem = self.ver
        for _ in range(12):
            rem = (rem << 1) ^ ((rem >> 11) * 0x1F25)
        bits = self.ver << 12 | rem
        for i in range(18):
            dark = _bit(bits, i)
            a, b = self.size - 11 + i % 3, i // 3
            self.set_fixed(a, b, dark)
            self.set_fixed(b, a, dark)

    def draw_codewords(self, codewords):
        n = self.size
        i = 0
        total = len(codewords) * 8
        right = n - 1
        while right >= 1:
            if right == 6:
                right = 5
            for vert in range(n):
                for j in range(2):
                    x = right - j
                    upward = (right + 1) & 2 == 0
                    y = n - 1 - vert if upward else vert
                    if not self.fixed[y][x] and i < total:
                        self.dark[y][x] = _bit(codewords[i >> 3], 7 - (i & 7))
                        i += 1
            right -= 2

    def apply_mask(self, mask):
        test = (
            lambda x, y: (x + y) % 2 == 0,
            lambda x, y: y % 2 == 0,
            lambda x, y: x % 3 == 0,
            lambda x, y: (x + y) % 3 == 0,
            lambda x, y: (x // 3 + y // 2) % 2 == 0,
            lambda x, y: x * y % 2 + x * y % 3 == 0,
            lambda x, y: (x * y % 2 + x * y % 3) % 2 == 0,
            lambda x, y: ((x + y) % 2 + x * y % 3) % 2 == 0,
        )[mask]
        for y in range(self.size):
            for x in range(self.size):
                if not self.fixed[y][x] and test(x, y):
                    self.dark[y][x] = not self.dark[y][x]

    def penalty(self):
        n = self.size
        score = 0
        lines = [row for row in self.dark] + [[self.dark[y][x] for y in range(n)] for x in range(n)]
        finder = [True, False, True, True, True, False, True]
        quiet = [False] * 4
        for line in lines:
            run = 1
            for i in range(1, n + 1):
                if i < n and line[i] == line[i - 1]:
                    run += 1
                    continue
                if run >= 5:
                    score += run - 2
                run = 1
            padded = quiet + list(line) + quiet
            for i in range(len(padded) - 10):
                window = padded[i:i + 11]
                if window == finder + quiet or window == quiet + finder:
                    score += 40
        for y in range(n - 1):
            for x in range(n - 1):
                c = self.dark[y][x]
                if c == self.dark[y][x + 1] == self.dark[y + 1][x] == self.dark[y + 1][x + 1]:
                    score += 3
        dark = sum(map(sum, self.dark))
        total = n * n
        score += ((abs(dark * 20 - total * 10) + total - 1) // total - 1) * 10
        return score


def encode(text, mask=None):
    """Return the QR symbol for `text` as a list of rows of booleans (True = dark),
    without the quiet zone."""
    ver, data = _encode_data(text.encode("utf-8"))
    codewords = _add_ecc_and_interleave(ver, data)
    grid = _Grid(ver)
    grid.draw_function_patterns()
    grid.draw_codewords(codewords)
    if mask is None:
        best = None
        for candidate in range(8):
            grid.apply_mask(candidate)
            grid.draw_format_bits(candidate)
            score = grid.penalty()
            if best is None or score < best[0]:
                best = (score, candidate)
            grid.apply_mask(candidate)  # XOR again to undo
        mask = best[1]
    grid.apply_mask(mask)
    grid.draw_format_bits(mask)
    return [row[:] for row in grid.dark]


def encode_rows(text):
    """Rows as strings of '1' (dark) and '0', convenient to send to the frontend."""
    return ["".join("1" if c else "0" for c in row) for row in encode(text)]
