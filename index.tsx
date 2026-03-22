import Layout from "@/components/Layout";
import AnimatedSection from "@/components/AnimatedSection";
import { Button } from "@/components/ui/button";
import { ArrowRight, Eye, EyeOff, Sparkles, Heart, Clock, Shield, Zap, Users } from "lucide-react";
import { Link } from "react-router-dom";

const storyCards = [
    { gradient: "story-gradient-1", text: "Just told my crush how I feel... anonymously 💜", time: "2m ago", reactions: "🔥 142" },
    { gradient: "story-gradient-2", text: "Quit my job today. No regrets. Here's my story.", time: "5m ago", reactions: "💪 89" },
    { gradient: "story-gradient-3", text: "Reminder: you're allowed to start over as many times as you need", time: "8m ago", reactions: "❤️ 231" },
    { gradient: "story-gradient-4", text: "3am thoughts hit different when you know no one knows who you are", time: "12m ago", reactions: "✨ 67" },
    { gradient: "story-gradient-5", text: "Posted my art for the first time ever. The freedom of anonymity 🎨", time: "15m ago", reactions: "🎨 178" },
    { gradient: "story-gradient-1", text: "Moving to a new city alone next week. Terrified but excited.", time: "18m ago", reactions: "🌟 94" },
    { gradient: "story-gradient-3", text: "Sometimes strangers understand you better than friends do", time: "22m ago", reactions: "💯 203" },
    { gradient: "story-gradient-2", text: "I forgave myself today. It took years but I did it.", time: "25m ago", reactions: "🥺 156" },
];

const features = [
    { icon: EyeOff, title: "Anonymous Posting", desc: "Share your truth without revealing who you are. No usernames, no profiles." },
    { icon: Clock, title: "Temporary Stories", desc: "Stories vanish after 24 hours. Say what you mean, then let it go." },
    { icon: Zap, title: "No Login Required", desc: "Jump in instantly. No sign-ups, no emails, no friction." },
    { icon: Heart, title: "Real Reactions", desc: "Get genuine reactions from real people who connect with your story." },
];

const steps = [
    { num: "01", title: "Write your story", desc: "Type whatever's on your mind. A confession, a thought, a moment." },
    { num: "02", title: "Post anonymously", desc: "Share it with the world — no one will ever know it's you." },
    { num: "03", title: "Watch it resonate", desc: "See reactions roll in from people who truly get it." },
];

const Index = () => (
    <Layout>
        {/* Hero */}
        <section className="relative overflow-hidden min-h-[90vh] flex items-center">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(265,85%,65%,0.1)_0%,transparent_50%)]" />
            <div className="absolute top-32 right-1/4 w-72 h-72 bg-accent/5 rounded-full blur-3xl animate-pulse-soft" />
            <div className="absolute bottom-20 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse-soft" style={{ animationDelay: "2s" }} />

            <div className="container mx-auto px-4 pt-20 pb-12 relative">
                <div className="grid lg:grid-cols-2 gap-12 items-center">
                    <AnimatedSection>
                        <div className="inline-flex items-center gap-2 glass rounded-full px-4 py-1.5 text-xs font-medium text-muted-foreground mb-6">
                            <Sparkles className="w-3.5 h-3.5 text-accent" />
                            The story-first social platform
                        </div>
                        <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.1] tracking-tight mb-5">
                            Say it. Post it.{" "}
                            <span className="gradient-text">Stay anonymous.</span>
                        </h1>
                        <p className="text-base sm:text-lg text-muted-foreground max-w-md leading-relaxed mb-8">
                            Express yourself without limits. Share stories, confessions, and moments — no one will ever know it was you.
                        </p>
                        <div className="flex flex-wrap gap-3">
                            <Button variant="hero" size="xl">
                                View Stories <Eye className="w-5 h-5" />
                            </Button>
                            <Button variant="hero-outline" size="xl">
                                Post a Story <ArrowRight className="w-5 h-5" />
                            </Button>
                        </div>
                        <div className="flex items-center gap-6 mt-8 text-sm text-muted-foreground">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                                <span>5.2k stories today</span>
                            </div>
                            <span>•</span>
                            <span>100% anonymous</span>
                        </div>
                    </AnimatedSection>

                    {/* Story cards preview - phone mockup feel */}
                    <AnimatedSection delay={0.2} className="hidden lg:block">
                        <div className="relative">
                            <div className="absolute -inset-4 bg-gradient-to-br from-primary/10 via-transparent to-accent/10 rounded-3xl blur-2xl" />
                            <div className="relative glass rounded-3xl p-5 neon-glow">
                                <div className="grid grid-cols-2 gap-3">
                                    {storyCards.slice(0, 4).map((story, i) => (
                                        <div
                                            key={i}
                                            className={`${story.gradient} rounded-2xl p-4 aspect-[3/4] flex flex-col justify-between hover-lift cursor-pointer`}
                                        >
                                            <p className="text-xs sm:text-sm font-medium text-primary-foreground leading-snug">{story.text}</p>
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] text-primary-foreground/60">{story.time}</span>
                                                <span className="text-[10px]">{story.reactions}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </AnimatedSection>
                </div>
            </div>
        </section>

        {/* Scrolling story strip (mobile-visible too) */}
        <section className="py-10 overflow-hidden border-y border-border/30 bg-card/20">
            <div className="flex animate-slide-stories" style={{ width: "max-content" }}>
                {[...storyCards, ...storyCards].map((story, i) => (
                    <div key={i} className={`${story.gradient} rounded-2xl p-4 w-52 h-64 flex-shrink-0 mx-2 flex flex-col justify-between hover-lift cursor-pointer`}>
                        <p className="text-xs font-medium text-primary-foreground leading-snug">{story.text}</p>
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] text-primary-foreground/60">{story.time}</span>
                            <span className="text-[10px]">{story.reactions}</span>
                        </div>
                    </div>
                ))}
            </div>
        </section>

        {/* Features */}
        <section className="py-20 md:py-28">
            <div className="container mx-auto px-4">
                <AnimatedSection className="text-center mb-14">
                    <p className="text-xs font-semibold text-accent mb-2 font-display tracking-widest uppercase">Features</p>
                    <h2 className="font-display text-3xl md:text-4xl font-bold">Built for <span className="gradient-text">real expression</span></h2>
                </AnimatedSection>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {features.map((f, i) => (
                        <AnimatedSection key={f.title} delay={i * 0.08}>
                            <div className="glass rounded-2xl p-6 h-full hover-lift group">
                                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/15 transition-colors">
                                    <f.icon className="w-5 h-5 text-primary" />
                                </div>
                                <h3 className="font-display font-semibold mb-2">{f.title}</h3>
                                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                            </div>
                        </AnimatedSection>
                    ))}
                </div>
            </div>
        </section>

        {/* How It Works */}
        <section className="py-20 md:py-28 bg-card/30">
            <div className="container mx-auto px-4">
                <AnimatedSection className="text-center mb-14">
                    <p className="text-xs font-semibold text-accent mb-2 font-display tracking-widest uppercase">How It Works</p>
                    <h2 className="font-display text-3xl md:text-4xl font-bold">Three steps to <span className="gradient-text-alt">freedom</span></h2>
                </AnimatedSection>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-3xl mx-auto">
                    {steps.map((s, i) => (
                        <AnimatedSection key={s.num} delay={i * 0.12}>
                            <div className="text-center">
                                <div className="font-display text-5xl font-extrabold gradient-text mb-3">{s.num}</div>
                                <h3 className="font-display font-semibold text-lg mb-2">{s.title}</h3>
                                <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
                            </div>
                        </AnimatedSection>
                    ))}
                </div>
            </div>
        </section>

        {/* Why Misto */}
        <section className="py-20 md:py-28">
            <div className="container mx-auto px-4">
                <div className="grid lg:grid-cols-2 gap-12 items-center max-w-5xl mx-auto">
                    <AnimatedSection>
                        <p className="text-xs font-semibold text-accent mb-2 font-display tracking-widest uppercase">Why Misto</p>
                        <h2 className="font-display text-3xl md:text-4xl font-bold mb-6">
                            Because your thoughts <span className="gradient-text">deserve to be heard</span>
                        </h2>
                        <div className="space-y-4 text-muted-foreground leading-relaxed text-sm">
                            <p>Social media made us performers. Every post is curated, every caption is calculated, every story is a personal brand exercise.</p>
                            <p>Misto flips the script. Here, your words matter — not your followers, your face, or your name. Just raw, unfiltered you.</p>
                            <p>No judgment. No history. No pressure. Just stories from real humans who want to be heard.</p>
                        </div>
                    </AnimatedSection>
                    <AnimatedSection delay={0.15}>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="glass rounded-2xl p-5 neon-glow">
                                <Users className="w-6 h-6 text-primary mb-3" />
                                <div className="font-display text-2xl font-bold">1.2M+</div>
                                <div className="text-xs text-muted-foreground mt-1">Stories shared</div>
                            </div>
                            <div className="glass rounded-2xl p-5 neon-glow-pink">
                                <Heart className="w-6 h-6 text-accent mb-3" />
                                <div className="font-display text-2xl font-bold">8.4M+</div>
                                <div className="text-xs text-muted-foreground mt-1">Reactions given</div>
                            </div>
                            <div className="glass rounded-2xl p-5 col-span-2">
                                <Shield className="w-6 h-6 text-neon-blue mb-3" />
                                <div className="font-display text-2xl font-bold">100%</div>
                                <div className="text-xs text-muted-foreground mt-1">Anonymous & encrypted. Always.</div>
                            </div>
                        </div>
                    </AnimatedSection>
                </div>
            </div>
        </section>

        {/* Final CTA */}
        <section className="py-20 md:py-28 relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(265,85%,65%,0.08)_0%,transparent_60%)]" />
            <AnimatedSection className="container mx-auto px-4 text-center relative">
                <h2 className="font-display text-3xl md:text-5xl font-bold mb-4">
                    Ready to share your <span className="gradient-text-alt">story?</span>
                </h2>
                <p className="text-muted-foreground max-w-md mx-auto mb-8">
                    No sign-up. No identity. Just you and your thoughts. Start exploring or post your first anonymous story.
                </p>
                <div className="flex flex-wrap gap-3 justify-center">
                    <Button variant="hero" size="xl">Start Exploring Stories <ArrowRight className="w-5 h-5" /></Button>
                </div>
            </AnimatedSection>
        </section>
    </Layout>
);

export default Index;
