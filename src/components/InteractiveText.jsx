import React from 'react';

const PAGE_NAMES = ['Home', 'About', 'Projects', 'Career', 'Book', 'Contact'];

export default function InteractiveText({ text = '', rules = [], page, onNavigate, className = '' }) {
  const activeRules = (Array.isArray(rules) ? rules : [])
    // Rule tanpa tujuan bukan link yang berfungsi, jadi jangan dirender atau
    // ikut disorot Help. Editor formulirnya tetap hanya ada di src/cms.
    .filter((rule) => rule?.enabled !== false && rule?.phrase && rule?.target && (!rule.page || rule.page === page))
    .sort((a, b) => b.phrase.length - a.phrase.length);

  if (!text || !activeRules.length) return <>{text}</>;

  const escaped = activeRules.map((rule) => rule.phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const matcher = new RegExp(`(${escaped.join('|')})`, 'gi');
  const ruleMap = new Map(activeRules.map((rule) => [rule.phrase.toLocaleLowerCase(), rule]));

  return String(text).split(matcher).map((part, index) => {
    const rule = ruleMap.get(part.toLocaleLowerCase());
    if (!rule) return <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>;
    const target = rule.target || '';
    const internal = PAGE_NAMES.includes(target);
    const style = {
      color: rule.textColor || 'inherit',
      textDecorationColor: rule.underlineColor || '#dc2626',
    };
    const shared = {
      key: `${part}-${index}`,
      className: `interactive-word ${className}`,
      style,
      title: rule.tooltip || `Buka ${target}`,
      'data-hint-id': `interactive-word-${index}`,
    };

    if (internal) {
      return <button type="button" {...shared} onClick={() => onNavigate?.(target)}>{part}</button>;
    }
    return <a {...shared} href={target || '#'} target={rule.newTab ? '_blank' : undefined} rel={rule.newTab ? 'noreferrer' : undefined}>{part}</a>;
  });
}
