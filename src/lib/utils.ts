export function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}

export function formatNumber(n: number): string {
  if (n >= 1000) {
    return (n / 1000).toFixed(n >= 10000 ? 1 : 2).replace(/\.?0+$/, "") + "K";
  }
  return n.toLocaleString();
}

export function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(n);
}

export function formatUGX(n: number): string {
  return "UGX " + new Intl.NumberFormat("en-UG", { maximumFractionDigits: 0 }).format(n);
}
