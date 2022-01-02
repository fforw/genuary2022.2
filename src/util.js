export function clamp(v)
{
    return v < 0 ? 0 : v > 255 ? 255 : v;
}
