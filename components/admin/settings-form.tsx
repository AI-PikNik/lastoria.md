"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ImagePlus, Loader2, X } from "lucide-react";
import { updateSettings, uploadBrandAsset } from "@/lib/actions/settings";
import { countWords } from "@/lib/seo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { LocalizedFields, type LocalizedValue } from "./localized-fields";

export interface SettingsFormValues {
  restaurantName: string;
  restaurantPhone: string;
  restaurantAddress: string;
  restaurantEmail: string;
  workingHours: LocalizedValue;
  minOrderAmount: string;
  seoTitles: LocalizedValue;
  seoDescriptions: LocalizedValue;
  shortAnswers: LocalizedValue;
  telegramChatId: string;
  emailSenderAddress: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  heroImageUrl: string | null;
  geoLat: string;
  geoLng: string;
  cookieBannerEnabled: boolean;
  analyticsId: string;
}

export function SettingsForm({ initial }: { initial: SettingsFormValues }) {
  const router = useRouter();
  const [v, setV] = React.useState(initial);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, setPending] = React.useState(false);
  const set = <K extends keyof SettingsFormValues>(key: K, value: SettingsFormValues[K]) =>
    setV((prev) => ({ ...prev, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    const result = await updateSettings({
      ...v,
      geoLat: v.geoLat === "" ? null : v.geoLat,
      geoLng: v.geoLng === "" ? null : v.geoLng,
    });
    setPending(false);
    if (!result.ok) {
      setErrors(result.fieldErrors ?? {});
      toast.error(result.error ?? "Проверьте форму");
      return;
    }
    setErrors({});
    toast.success("Настройки сохранены — сайт обновлён");
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      <Section title="Ресторан" description="Название, телефон и адрес показываются в шапке, подвале, на странице «Контакты» и в разметке для поисковиков.">
        <div className="grid gap-4 md:grid-cols-2">
          <Text label="Название" value={v.restaurantName} onChange={(x) => set("restaurantName", x)} error={errors.restaurantName} />
          <Text label="Телефон" value={v.restaurantPhone} onChange={(x) => set("restaurantPhone", x)} error={errors.restaurantPhone} placeholder="+373 22 000 000" />
          <Text label="Адрес (для самовывоза и контактов)" value={v.restaurantAddress} onChange={(x) => set("restaurantAddress", x)} error={errors.restaurantAddress} />
          <Text label="Email (необязательно)" value={v.restaurantEmail} onChange={(x) => set("restaurantEmail", x)} error={errors.restaurantEmail} />
          <Text label="Минимальная сумма заказа, MDL" type="number" value={v.minOrderAmount} onChange={(x) => set("minOrderAmount", x)} />
          <div className="grid grid-cols-2 gap-3">
            <Text label="Широта (карта)" value={v.geoLat} onChange={(x) => set("geoLat", x)} placeholder="47.0245" />
            <Text label="Долгота (карта)" value={v.geoLng} onChange={(x) => set("geoLng", x)} placeholder="28.8322" />
          </div>
        </div>
        <LocalizedFields id="hours" label="Часы работы" value={v.workingHours} onChange={(x) => set("workingHours", x)} placeholder="Zilnic, 10:00–22:00" />
      </Section>

      <Section title="Бренд: логотип, иконка, главная картинка" description="Если логотип не загружен — в шапке показывается текстовый логотип темы.">
        <div className="grid gap-4 md:grid-cols-3">
          <BrandUpload label="Логотип (PNG/SVG, прозрачный фон)" kind="logo" value={v.logoUrl} onChange={(x) => set("logoUrl", x)} />
          <BrandUpload label="Favicon (иконка во вкладке, квадрат 512×512)" kind="favicon" value={v.faviconUrl} onChange={(x) => set("faviconUrl", x)} />
          <BrandUpload label="Картинка на главной (по умолчанию — постер)" kind="hero" value={v.heroImageUrl} onChange={(x) => set("heroImageUrl", x)} />
        </div>
      </Section>

      <Section title="SEO по умолчанию" description="Заголовок и описание главной страницы на каждом языке. Пустой язык → румынский.">
        <LocalizedFields id="seoTitles" label="SEO-заголовок главной (до 60 символов)" value={v.seoTitles} onChange={(x) => set("seoTitles", x)} maxLength={200} />
        <LocalizedFields id="seoDescriptions" label="SEO-описание (70–160 символов)" value={v.seoDescriptions} onChange={(x) => set("seoDescriptions", x)} multiline rows={3} maxLength={500} />
        <LocalizedFields
          id="shortAnswers"
          label="«Короткий ответ» на главной (40–80 слов)"
          hint={`Кто вы, что продаёте, где, часы, как заказать — без выдумок. Пусто — собирается автоматически из настроек. Сейчас: ${(["ro", "ru", "en", "it"] as const)
            .map((l) => `${l.toUpperCase()} ${countWords(v.shortAnswers[l])} сл.`)
            .join(" · ")}`}
          value={v.shortAnswers}
          onChange={(x) => set("shortAnswers", x)}
          multiline
          rows={4}
          maxLength={1500}
        />
      </Section>

      <Section title="Уведомления" description="Токен Telegram-бота и SMTP-почта задаются в файле .env (см. README). Здесь — куда отправлять.">
        <div className="grid gap-4 md:grid-cols-2">
          <Text label="Telegram chat ID (пусто — из .env)" value={v.telegramChatId} onChange={(x) => set("telegramChatId", x)} placeholder="-1001234567890" />
          <Text label="Email отправителя писем" value={v.emailSenderAddress} onChange={(x) => set("emailSenderAddress", x)} error={errors.emailSenderAddress} />
        </div>
      </Section>

      <Section title="Cookies и аналитика" description="Аналитика подключается только после того, как посетитель нажал «Принять» в cookie-баннере.">
        <label className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm">
          <span>
            <span className="font-medium">Показывать cookie-баннер</span>
            <span className="block text-xs text-muted-foreground">Без баннера аналитика не включится ни у кого</span>
          </span>
          <Switch checked={v.cookieBannerEnabled} onCheckedChange={(x) => set("cookieBannerEnabled", x)} />
        </label>
        <Text label="Google Analytics ID (необязательно)" value={v.analyticsId} onChange={(x) => set("analyticsId", x.toUpperCase())} error={errors.analyticsId} placeholder="G-XXXXXXXXXX" />
      </Section>

      <div className="sticky bottom-0 z-10 flex justify-end border-t border-border bg-background/95 py-3 backdrop-blur">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Сохранение…" : "Сохранить настройки"}
        </Button>
      </div>
    </form>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-5">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function Text({
  label,
  value,
  onChange,
  error,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block space-y-1 text-sm font-medium">
      {label}
      <Input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      {error && <span className="block text-xs text-destructive">{error}</span>}
    </label>
  );
}

function BrandUpload({
  label,
  kind,
  value,
  onChange,
}: {
  label: string;
  kind: "logo" | "favicon" | "hero";
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [pending, setPending] = React.useState(false);

  const upload = async (file: File) => {
    setPending(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("kind", kind);
    const result = await uploadBrandAsset(formData);
    setPending(false);
    if (!result.ok || !result.url) {
      toast.error(result.error ?? "Не удалось загрузить");
      return;
    }
    onChange(result.url);
    toast.success("Файл загружен. Нажмите «Сохранить настройки».");
  };

  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <p className="text-sm font-medium">{label}</p>
      <div className="relative flex h-28 items-center justify-center overflow-hidden rounded-md bg-muted">
        {value ? (
          <Image src={value} alt="" fill sizes="300px" className={kind === "hero" ? "object-cover" : "object-contain p-2"} unoptimized={value.endsWith(".svg") || value.endsWith(".ico")} />
        ) : (
          <span className="text-xs text-muted-foreground">не загружено</span>
        )}
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <ImagePlus />}
          {value ? "Заменить" : "Загрузить"}
        </Button>
        {value && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
            <X /> Сбросить
          </Button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={kind === "hero" ? "image/jpeg,image/png,image/webp" : "image/jpeg,image/png,image/webp,image/svg+xml,image/x-icon,.ico"}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
