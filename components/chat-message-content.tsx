import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";

import { EchoText } from "@/components/echo-text";
import type { ColorScheme, ThemeColorPalette } from "@/constants/theme";
import { parseChatMarkdown, type ChatMarkdownBlock } from "@/lib/chat-markdown";

type Props = {
  content: string;
  colors: ThemeColorPalette;
  colorScheme: ColorScheme;
  selectable?: boolean;
};

function inlineNodes(text: string, colors: ThemeColorPalette, selectable: boolean): ReactNode[] {
  const tokenPattern = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*]+\*|_[^_]+_|!?\[[^\]]+\]\([^)]+\))/g;
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = tokenPattern.exec(text)) !== null) {
    if (match.index > cursor) {
      nodes.push(<EchoText key={`t-${key++}`} selectable={selectable}>{text.slice(cursor, match.index)}</EchoText>);
    }
    const token = match[0];
    if (token.startsWith("**") || token.startsWith("__")) {
      nodes.push(<EchoText key={`b-${key++}`} selectable={selectable} style={{ fontWeight: "700" }}>{token.slice(2, -2)}</EchoText>);
    } else if (token.startsWith("`")) {
      nodes.push(
        <EchoText
          key={`c-${key++}`}
          selectable={selectable}
          style={{
            fontFamily: "monospace",
            fontSize: 13,
            color: colors.foreground,
            backgroundColor: colors.background,
          }}
        >
          {token.slice(1, -1)}
        </EchoText>,
      );
    } else if (token.startsWith("[") || token.startsWith("![")) {
      const label = token.match(/^!?\[([^\]]+)\]/)?.[1] ?? token;
      nodes.push(
        <EchoText key={`l-${key++}`} selectable={selectable} style={{ color: colors.primary, textDecorationLine: "underline" }}>
          {label}
        </EchoText>,
      );
    } else {
      nodes.push(<EchoText key={`i-${key++}`} selectable={selectable} style={{ fontStyle: "italic" }}>{token.slice(1, -1)}</EchoText>);
    }
    cursor = match.index + token.length;
  }

  if (cursor < text.length) {
    nodes.push(<EchoText key={`t-${key++}`} selectable={selectable}>{text.slice(cursor)}</EchoText>);
  }
  return nodes;
}

function InlineText({
  text,
  colors,
  selectable,
  style,
}: {
  text: string;
  colors: ThemeColorPalette;
  selectable: boolean;
  style?: object;
}) {
  return (
    <EchoText selectable={selectable} style={[{ color: colors.foreground }, style]}>
      {inlineNodes(text, colors, selectable)}
    </EchoText>
  );
}

function badgePalette(value: string, colors: ThemeColorPalette, colorScheme: ColorScheme) {
  const normalized = value.toLocaleLowerCase("tr-TR");
  if (["hata", "error", "failed", "başarısız", "iptal", "kritik", "reddedildi"].some((word) => normalized.includes(word))) {
    return colorScheme === "dark"
      ? { background: "#451A1A", foreground: "#FECACA" }
      : { background: "#FEE2E2", foreground: "#991B1B" };
  }
  if (["bekle", "pending", "uyarı", "warning", "orta", "dikkat"].some((word) => normalized.includes(word))) {
    return colorScheme === "dark"
      ? { background: "#422006", foreground: "#FDE68A" }
      : { background: "#FEF3C7", foreground: "#92400E" };
  }
  if (["tamamlandı", "başarılı", "success", "active", "aktif", "hazır", "onaylandı", "complete"].some((word) => normalized.includes(word))) {
    return colorScheme === "dark"
      ? { background: "#163626", foreground: "#BBF7D0" }
      : { background: "#DCFCE7", foreground: "#166534" };
  }
  return { background: colors.primary, foreground: colors.background };
}

function statusColumn(headers: string[]): number {
  const statusHeader = /durum|status|kategori|category|tür|tur|type|öncelik|priority|seviye/i;
  const found = headers.findIndex((header, index) => index > 0 && statusHeader.test(header));
  return found > 0 ? found : headers.length > 1 ? 1 : -1;
}

function TableCards({
  block,
  colors,
  colorScheme,
  selectable,
}: {
  block: Extract<ChatMarkdownBlock, { type: "table" }>;
  colors: ThemeColorPalette;
  colorScheme: ColorScheme;
  selectable: boolean;
}) {
  const badgeColumn = statusColumn(block.headers);
  return (
    <View style={{ gap: 9, width: "100%" }}>
      {block.rows.map((row, rowIndex) => {
        const title = row[0]?.trim() || `Satır ${rowIndex + 1}`;
        const badgeText = badgeColumn >= 0 ? row[badgeColumn]?.trim() : "";
        const badge = badgeText ? badgePalette(badgeText, colors, colorScheme) : null;
        const details = block.headers
          .map((header, columnIndex) => ({ header, value: row[columnIndex] ?? "", columnIndex }))
          .filter(({ columnIndex, value }) => columnIndex !== 0 && columnIndex !== badgeColumn && value.trim().length > 0);

        return (
          <View
            key={`row-${rowIndex}`}
            accessibilityLabel={`Tablo satırı ${rowIndex + 1}: ${title}`}
            style={{
              width: "100%",
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              padding: 13,
              gap: 10,
              shadowColor: "#000000",
              shadowOpacity: colorScheme === "dark" ? 0.18 : 0.07,
              shadowRadius: 5,
              shadowOffset: { width: 0, height: 2 },
              elevation: 1,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
              <InlineText
                text={title}
                colors={colors}
                selectable={selectable}
                style={{ flex: 1, fontSize: 15, lineHeight: 21, fontWeight: "700" }}
              />
              {badgeText && badge ? (
                <View style={{ maxWidth: "46%", paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, backgroundColor: badge.background }}>
                  <EchoText numberOfLines={2} selectable={selectable} style={{ color: badge.foreground, fontSize: 10, lineHeight: 14, fontWeight: "700", textAlign: "center" }}>
                    {badgeText}
                  </EchoText>
                </View>
              ) : null}
            </View>
            {details.length > 0 ? (
              <View style={{ gap: 9, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 9 }}>
                {details.map(({ header, value, columnIndex }) => (
                  <View key={`detail-${columnIndex}`} style={{ flexDirection: "row", alignItems: "flex-start", gap: 9 }}>
                    <EchoText style={{ width: 88, color: colors.muted, fontSize: 11, lineHeight: 16, fontWeight: "600" }}>
                      {header}
                    </EchoText>
                    <InlineText text={value} colors={colors} selectable={selectable} style={{ flex: 1, fontSize: 13, lineHeight: 19 }} />
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function MarkdownBlockView({
  block,
  colors,
  colorScheme,
  selectable,
}: {
  block: ChatMarkdownBlock;
  colors: ThemeColorPalette;
  colorScheme: ColorScheme;
  selectable: boolean;
}) {
  if (block.type === "code") {
    return (
      <View style={{ width: "100%", borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
        <View style={{ paddingHorizontal: 11, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <EchoText style={{ color: colors.muted, fontSize: 10, fontWeight: "700" }}>{block.language || "KOD"}</EchoText>
        </View>
        <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 12 }}>
          <EchoText selectable={selectable} style={{ color: colors.foreground, fontFamily: "monospace", fontSize: 12, lineHeight: 19 }}>
            {block.code}
          </EchoText>
        </ScrollView>
      </View>
    );
  }

  if (block.type === "table") {
    return <TableCards block={block} colors={colors} colorScheme={colorScheme} selectable={selectable} />;
  }

  if (block.type === "heading") {
    const fontSize = block.level === 1 ? 22 : block.level === 2 ? 19 : 16;
    return <InlineText text={block.text} colors={colors} selectable={selectable} style={{ fontSize, lineHeight: fontSize + 7, fontWeight: "700" }} />;
  }

  if (block.type === "quote") {
    return (
      <View style={{ width: "100%", borderLeftWidth: 3, borderLeftColor: colors.primary, paddingLeft: 11, paddingVertical: 4 }}>
        <InlineText text={block.text} colors={colors} selectable={selectable} style={{ color: colors.muted, fontSize: 14, lineHeight: 21 }} />
      </View>
    );
  }

  if (block.type === "list") {
    return (
      <View style={{ width: "100%", gap: 6 }}>
        {block.items.map((item, itemIndex) => (
          <View key={`item-${itemIndex}`} style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
            <EchoText style={{ color: colors.primary, fontSize: 14, lineHeight: 22, fontWeight: "700" }}>
              {block.ordered ? `${itemIndex + 1}.` : "•"}
            </EchoText>
            <InlineText text={item} colors={colors} selectable={selectable} style={{ flex: 1, fontSize: 15, lineHeight: 22 }} />
          </View>
        ))}
      </View>
    );
  }

  return <InlineText text={block.text} colors={colors} selectable={selectable} style={{ fontSize: 15, lineHeight: 23 }} />;
}

export function ChatMessageContent({ content, colors, colorScheme, selectable = true }: Props) {
  const blocks = parseChatMarkdown(content);
  return (
    <View style={{ width: "100%", gap: 9 }}>
      {blocks.map((block, index) => (
        <MarkdownBlockView
          key={`block-${index}`}
          block={block}
          colors={colors}
          colorScheme={colorScheme}
          selectable={selectable}
        />
      ))}
    </View>
  );
}
