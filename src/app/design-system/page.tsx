import type { Metadata } from "next";

import { BottomNav, PageContainer, PageHeader } from "@/components/layout";
import {
  Avatar,
  AvatarGroup,
  Badge,
  Button,
  Card,
  Divider,
  GameModeCard,
  Icon,
  IconButton,
  Input,
  MoviePoster,
  ProgressBar,
  ResultScore,
  Stat,
} from "@/components/ui";

export const metadata: Metadata = {
  title: "Design system",
  description:
    "The foundational interface language and component library for vidi.",
};

const players = [
  { name: "Sarah Chen" },
  { name: "Mo Adeyemi" },
  { name: "Jamie Lee" },
  { name: "Alex Morgan" },
  { name: "Nia Brooks" },
];

const navItems = [
  { href: "#colour", icon: "home" as const, label: "Tokens" },
  { href: "#game-components", icon: "game" as const, label: "Game" },
  { href: "#players", icon: "users" as const, label: "Players" },
  { href: "#stats-results", icon: "profile" as const, label: "Results" },
];

function Section({
  children,
  description,
  id,
  title,
}: {
  children: React.ReactNode;
  description?: string;
  id?: string;
  title: string;
}) {
  return (
    <section className="grid scroll-mt-8 gap-5" id={id}>
      <div className="grid gap-1.5">
        <h2 className="text-title">{title}</h2>
        {description && (
          <p className="text-muted max-w-2xl text-sm leading-6">
            {description}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}

export default function DesignSystemPage() {
  return (
    <main className="pb-28">
      <PageContainer>
        <PageHeader
          action={{ icon: "spark", label: "Design principles" }}
          eyebrow="Foundation / 01"
          title="Design system"
        />

        <div className="border-border relative overflow-hidden border-y py-14 sm:py-20">
          <div className="bg-purple/15 absolute top-0 right-0 size-48 rounded-full blur-3xl" />
          <p className="text-label text-accent mb-5">seen it? prove it.</p>
          <h1 className="text-display-xl max-w-4xl">
            Fast feels
            <br />
            <span className="text-purple">personal.</span>
          </h1>
          <p className="text-body text-muted mt-7 max-w-lg">
            A cinematic interface kit built for quick decisions, shared
            reactions, and results worth talking about.
          </p>
        </div>

        <div className="grid gap-20 py-16 sm:gap-28 sm:py-24">
          <Section
            description="Semantic colors carry meaning. Green is action, purple is taste and personality, warm white is editorial emphasis."
            id="colour"
            title="Colour"
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["Canvas", "bg-background", "#090909"],
                ["Action", "bg-accent text-background", "#C7FF18"],
                ["Warm white", "bg-foreground text-background", "#F1EFE7"],
                ["Personality", "bg-purple text-background", "#A78BFA"],
              ].map(([name, classes, value]) => (
                <div className="grid gap-3" key={name}>
                  <div
                    className={`border-border aspect-square rounded-lg border ${classes}`}
                  />
                  <div>
                    <p className="text-sm font-semibold">{name}</p>
                    <p className="text-subtle text-xs">{value}</p>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section
            description="Geist stays clear at game speed. Roboto Condensed adds editorial force to titles, modes, and results."
            title="Typography"
          >
            <Card className="grid gap-8" padding="lg">
              <p className="text-display-lg">Movies bring us together.</p>
              <Divider />
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <p className="text-label text-purple mb-2">Display / 40–88</p>
                  <p className="font-display text-5xl leading-none font-extrabold tracking-[-0.045em] uppercase">
                    Proper game
                  </p>
                </div>
                <div>
                  <p className="text-label text-accent mb-2">UI / 16</p>
                  <p className="text-body">
                    Clean, quick, and legible from the smallest supported screen
                    upward.
                  </p>
                </div>
              </div>
            </Card>
          </Section>

          <Section
            description="Every action responds on press. Disabled states remain legible and never depend on colour alone."
            title="Buttons & icons"
          >
            <Card className="grid gap-6" padding="lg">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Button leadingIcon={<Icon name="plus" />}>Create game</Button>
                <Button
                  trailingIcon={<Icon name="chevron-right" />}
                  variant="secondary"
                >
                  Join game
                </Button>
                <Button variant="purple">Compare taste</Button>
                <Button variant="outline">View results</Button>
                <Button variant="ghost">Maybe later</Button>
                <Button disabled>Unavailable</Button>
              </div>
              <Divider label="Icon buttons" />
              <div className="flex flex-wrap gap-3">
                <IconButton label="Go back">
                  <Icon name="arrow-left" />
                </IconButton>
                <IconButton label="Add player" variant="solid">
                  <Icon name="plus" />
                </IconButton>
                <IconButton label="Search">
                  <Icon name="search" />
                </IconButton>
                <IconButton disabled label="Close">
                  <Icon name="close" />
                </IconButton>
              </div>
            </Card>
          </Section>

          <Section
            description="Containers use restrained depth, strong grouping, and no gratuitous glass effects."
            title="Cards & badges"
          >
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <Badge variant="accent">Live</Badge>
                <h3 className="text-title mt-8">Friday films</h3>
                <p className="text-muted mt-2 text-sm">4 of 5 players ready.</p>
              </Card>
              <Card variant="purple">
                <Badge variant="purple">Taste twin</Badge>
                <h3 className="text-title mt-8">You + Sarah</h3>
                <p className="text-muted mt-2 text-sm">
                  Suspiciously compatible.
                </p>
              </Card>
              <Card variant="outline">
                <Badge variant="outline">Complete</Badge>
                <h3 className="text-title mt-8">Quick game</h3>
                <p className="text-muted mt-2 text-sm">30 films. 01:48.</p>
              </Card>
            </div>
          </Section>

          <Section
            description="Inputs are large enough for touch, provide clear instructions, and expose error semantics."
            title="Inputs"
          >
            <Card className="grid gap-5 sm:grid-cols-2" padding="lg">
              <Input
                hint="Six characters, no spaces."
                label="Game code"
                placeholder="V1D1X9"
              />
              <Input
                error="That code doesn’t look right."
                label="Game code — error"
                placeholder="Try again"
              />
              <Input
                disabled
                label="Display name — disabled"
                placeholder="Guest"
              />
            </Card>
          </Section>

          <Section
            description="Game-scale components remain clear at a glance and use motion only when a value materially changes."
            id="game-components"
            title="Game components"
          >
            <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
              <MoviePoster alt="Example movie poster" badge="Movie 18 / 30" />
              <div className="grid content-start gap-4">
                <ProgressBar label="Quick game" showValue value={60} />
                <ProgressBar
                  label="Taste match"
                  showValue
                  value={84}
                  variant="purple"
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <GameModeCard
                    description="A fast temperature check."
                    duration="≈ 2 minutes"
                    movieCount={30}
                    selected
                    title="Quick"
                  />
                  <GameModeCard
                    description="Enough films to get personal."
                    duration="≈ 7 minutes"
                    movieCount={100}
                    title="Proper"
                  />
                </div>
              </div>
            </div>
          </Section>

          <Section
            description="People stay recognizable at small sizes, with initials as a deliberate fallback."
            id="players"
            title="Players"
          >
            <Card className="flex flex-wrap items-center gap-6" padding="lg">
              <Avatar name="Sarah Chen" size="lg" />
              <AvatarGroup avatars={players} />
              <div className="ml-auto flex flex-wrap gap-2">
                <Badge variant="accent">Ready</Badge>
                <Badge variant="purple">Host</Badge>
                <Badge variant="outline">Waiting</Badge>
              </div>
            </Card>
          </Section>

          <Section
            description="Results lead with one memorable number, then reveal the evidence beneath it."
            id="stats-results"
            title="Stats & results"
          >
            <Card className="grid gap-10" padding="lg">
              <ResultScore
                caption="suspiciously compatible."
                label="Overall compatibility"
                score={91}
              />
              <Divider />
              <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
                <Stat detail="both seen" label="Overlap" value={67} />
                <Stat
                  detail="shared loves"
                  label="Favourites"
                  tone="accent"
                  value={14}
                />
                <Stat
                  detail="taste score"
                  label="Chemistry"
                  tone="purple"
                  value="88%"
                />
                <Stat detail="of 100" label="Knowledge" value={73} />
              </div>
            </Card>
          </Section>

          <Section
            description="Headers and navigation preserve wayfinding without turning the interface into a dashboard."
            title="Navigation"
          >
            <Card className="relative min-h-80 overflow-hidden" padding="none">
              <div className="px-4">
                <PageHeader
                  backLabel="Back to game"
                  eyebrow="Results"
                  title="Friday films"
                />
                <p className="text-display-lg mt-10">91% match.</p>
              </div>
              <BottomNav
                activeHref="#game-components"
                className="!absolute"
                items={navItems}
              />
            </Card>
          </Section>
        </div>
      </PageContainer>
    </main>
  );
}
