import { useState } from "react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { vulnerabilities } from "../lib/vulnerabilities";
import { initializeUserChallenges, challengeLevels, type ChallengeLevel } from "../lib/challengeProgress";
import { ChallengeCard } from "../components/play/ChallengeCard";
import { ChallengeEnvironment } from "../components/play/ChallengeEnvironment";
import {
  AlertTriangle,
  Database,
  Eye,
  Image,
  Download,
  Lock,
  Users,
  ShieldAlert,
  FileWarning,
  Zap,
  ChevronLeft,
  Target,
} from "lucide-react";
import { ProgressSummaryBar } from "../components/shared/ProgressSummaryBar";
import { FilterBar } from "../components/shared/FilterBar";
import { VulnerabilityCard } from "../components/shared/VulnerabilityCard";
import { ContinueTrainingBanner } from "../components/shared/ContinueTrainingBanner";

interface PlayPageProps {
  onNavigate: (page: string) => void;
}

const iconMap: Record<number, any> = {
  1: AlertTriangle,
  2: Database,
  3: Eye,
  4: Image,
  5: Download,
  6: Lock,
  7: Users,
  8: ShieldAlert,
  9: FileWarning,
  10: Zap,
};

export function PlayPage({ onNavigate }: PlayPageProps) {
  const [userChallenges] = useState(initializeUserChallenges());
  const [selectedVulnerabilityId, setSelectedVulnerabilityId] = useState<number | null>(null);
  const [activeChallenge, setActiveChallenge] = useState<{
    vulnerabilityId: number;
    level: ChallengeLevel;
  } | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [visibleCount, setVisibleCount] = useState(6);

  // Vulnerabilities that are work in progress (disabled)
  const workInProgressIds = [3, 5, 7, 9, 10]; // LLM03, LLM05, LLM07, LLM09, LLM10

  // Calculate challenge completion (10 vulnerabilities × 10 levels each = 100 total)
  const totalPossibleLevels = vulnerabilities.length * 10;
  const challengeCompletionPercentage = Math.round((userChallenges.totalLevelsCompleted / totalPossibleLevels) * 100);

  // Calculate modules with at least one level completed
  const modulesWithProgress = Object.values(userChallenges.challenges).filter(
    (challenge) => challenge.currentLevel > 1
  ).length;

  // Calculate average score across all completed challenges
  const totalScore = Object.values(userChallenges.challenges).reduce(
    (acc, challenge) => acc + challenge.totalScore,
    0
  );
  const averageScore = userChallenges.totalLevelsCompleted > 0
    ? Math.round(totalScore / userChallenges.totalLevelsCompleted)
    : 0;

  const handlePlayClick = (vulnerabilityId: number) => {
    // Don't allow clicking on work in progress vulnerabilities
    if (workInProgressIds.includes(vulnerabilityId)) {
      return;
    }

    // Auto-select Level 1 by default
    const levels = challengeLevels[vulnerabilityId] || challengeLevels[1]; // Fallback to LLM01 levels
    const level1 = levels[0] || challengeLevels[1][0];

    const levelData: ChallengeLevel = {
      ...level1,
      level: 1, // Ensure level number matches what API expects
    };

    setSelectedVulnerabilityId(vulnerabilityId);
    setActiveChallenge({
      vulnerabilityId,
      level: levelData,
    });
  };

  const handleLevelSelect = (levelNumber: number) => {
    const vulnerabilityId = activeChallenge?.vulnerabilityId || selectedVulnerabilityId;
    if (!vulnerabilityId) return;

    // Get the level data for the selected level
    const levels = challengeLevels[vulnerabilityId] || challengeLevels[1]; // Fallback to LLM01 levels
    const selectedLevel = levels[levelNumber - 1] || levels[0];

    // Create a ChallengeLevel object with the correct level number
    const levelData: ChallengeLevel = {
      ...selectedLevel,
      level: levelNumber, // Ensure level number matches what API expects
    };

    setActiveChallenge({
      vulnerabilityId,
      level: levelData,
    });
  };

  const handleChallengeExit = () => {
    setActiveChallenge(null);
    setSelectedVulnerabilityId(null);
  };

  const handleChallengeComplete = (score: number, timeSpent: number) => {
    // Update challenge progress
    // In real implementation, this would update state and sync to backend
    setActiveChallenge(null);
  };

  // Filter vulnerabilities based on active filter
  const filteredVulnerabilities = vulnerabilities.filter((vuln) => {
    if (activeFilter === 'all') return true;
    return vuln.severity === activeFilter;
  });

  // Get visible vulnerabilities based on "Load More" state
  const visibleVulnerabilities = filteredVulnerabilities.slice(0, visibleCount);
  const hasMore = visibleCount < filteredVulnerabilities.length;

  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + 4);
  };

  const handleFilterChange = (filter: 'all' | 'high' | 'medium' | 'low') => {
    setActiveFilter(filter);
    setVisibleCount(6); // Reset to initial count when filter changes
  };

  // Show challenge environment when a vulnerability is selected (with or without level)
  if (selectedVulnerabilityId || activeChallenge) {
    const vulnerabilityId = activeChallenge?.vulnerabilityId || selectedVulnerabilityId;
    const vulnerability = vulnerabilities.find((v) => v.id === vulnerabilityId);
    
    return (
      <ChallengeEnvironment
        challenge={activeChallenge?.level}
        vulnerabilityTitle={vulnerability?.title || "Unknown"}
        vulnerabilityId={vulnerabilityId || 0}
        onComplete={handleChallengeComplete}
        onExit={handleChallengeExit}
        onLevelSelect={handleLevelSelect}
        currentLevel={activeChallenge?.level?.level || 1}
      />
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header Section */}
      <div className="mb-6">
        <h1
          className="mb-2"
          style={{
            fontSize: '2rem',
            fontFamily: 'Source Sans Pro, sans-serif',
            fontWeight: 700,
            color: '#162E51',
          }}
        >
          Play Challenges
        </h1>
        <p
          style={{
            fontFamily: 'Source Sans Pro, sans-serif',
            fontSize: '1rem',
            color: '#475569',
          }}
        >
          Test your skills with hands-on security challenges.
        </p>
      </div>

      {/* Progress Summary Bar */}
      <ProgressSummaryBar
        modulesCompleted={modulesWithProgress}
        totalModules={vulnerabilities.length}
        averageScore={averageScore}
        currentProgress={challengeCompletionPercentage}
      />

      {/* Filter Bar */}
      <FilterBar activeFilter={activeFilter} onFilterChange={handleFilterChange} />

      {/* Challenge Card Grid */}
      <div 
        className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-4 lg:gap-6 mb-8 transition-opacity duration-400"
        style={{
          animation: 'fadeIn 0.4s ease-in-out',
        }}
      >
        {visibleVulnerabilities.map((vulnerability) => {
          const Icon = iconMap[vulnerability.id];
          const challengeProgress = userChallenges.challenges[vulnerability.id];
          const isCompleted = challengeProgress.currentLevel > 10; // All 10 levels completed
          const progress = Math.round(((challengeProgress.currentLevel - 1) / 10) * 100);
          const isWorkInProgress = workInProgressIds.includes(vulnerability.id);

          return (
            <VulnerabilityCard
              key={vulnerability.id}
              id={vulnerability.id}
              title={vulnerability.title}
              description={isWorkInProgress 
                ? "This challenge is currently under development. Check back soon!"
                : vulnerability.description
              }
              severity={vulnerability.severity}
              icon={Icon}
              isCompleted={isCompleted}
              progress={progress}
              onAction={() => handlePlayClick(vulnerability.id)}
              actionLabel={isCompleted ? "Replay" : "Play"}
              isWorkInProgress={isWorkInProgress}
            />
          );
        })}
      </div>

      {/* Load More Button */}
      {hasMore && (
        <div className="flex justify-center mb-8">
          <Button
            onClick={handleLoadMore}
            variant="outline"
            size="lg"
            className="px-8"
            style={{
              fontFamily: 'Public Sans, sans-serif',
              fontWeight: 600,
            }}
          >
            Load More Challenges
          </Button>
        </div>
      )}

      {/* Continue Training Banner */}
      <ContinueTrainingBanner
        onContinue={() => onNavigate("leaderboard")}
        buttonText="View Leaderboard"
      />

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
