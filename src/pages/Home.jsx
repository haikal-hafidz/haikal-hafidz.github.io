import FeaturedWorksCarousel from '../components/FeaturedWorksCarousel';
import HomeExperience from '../components/HomeExperience';
import VisitorIntroduction from '../components/VisitorIntroduction';

export default function Home({ data, zineData, miniGameData, featuredWorks = [], onOpenWork, interactiveWords = [], onNavigate }) {
  return (
    <div className="w-full select-text">
      <div className="mb-6 md:hidden">
        <VisitorIntroduction data={data?.visitorIntroduction} darkMode={false} soundEnabled={false} hintActive={false} inline />
      </div>
      <HomeExperience data={data} zineData={zineData} miniGameData={miniGameData} interactiveWords={interactiveWords} onNavigate={onNavigate} />
      <div className="mt-10 md:hidden">
        <FeaturedWorksCarousel
          featuredWorks={featuredWorks}
          heading={data?.featuredWorksHeading}
          onOpenWork={onOpenWork}
          axis="horizontal"
        />
      </div>
    </div>
  );
}
