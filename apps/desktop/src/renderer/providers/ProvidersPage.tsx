import { Building2, ExternalLink } from "lucide-react";

import type { Translator } from "../shared/I18n";
import type { LanguagePreference } from "../settings/Preferences";
import { ProviderCatalog } from "./ProviderCatalog";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";

type ProvidersPageProps = {
  language: LanguagePreference;
  t: Translator;
  onOpenOfficialLink(url: string): Promise<void> | void;
};

export function ProvidersPage({ language, t, onOpenOfficialLink }: ProvidersPageProps) {
  const providers = ProviderCatalog.shared.list(language);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-muted/40">
            <Building2 className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <CardTitle>{t("providers.title")}</CardTitle>
            <CardDescription>{t("providers.description")}</CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("providers.table.provider")}</TableHead>
                <TableHead>{t("providers.table.key")}</TableHead>
                <TableHead>{t("providers.table.link")}</TableHead>
                <TableHead>{t("providers.table.description")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {providers.map((provider) => (
                <TableRow key={provider.providerKey}>
                  <TableCell className="font-medium">{provider.provider}</TableCell>
                  <TableCell>
                    <code className="rounded bg-muted px-2 py-1 text-xs">{provider.providerKey}</code>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void onOpenOfficialLink(provider.officialLink)}
                    >
                      <ExternalLink className="h-4 w-4" />
                      {t("providers.openOfficialSite")}
                    </Button>
                  </TableCell>
                  <TableCell className="min-w-[320px] text-muted-foreground">
                    {provider.description}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
