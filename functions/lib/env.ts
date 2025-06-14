export function getEnv(name: string): string {
    const val = Deno.env.get(name);
    if (!val) throw new Error(`Missing env: ${name}`);
    return val;
}