import streamlit as st
import streamlit.components.v1 as components
import random
import json
import os
import time

# ==========================================
# 1. 홈 화면 페이지
# ==========================================
def home_page():
    st.title("🌟 환영합니다! 세윤이의 게임 월드.")
    st.subheader("스트림릿(Streamlit)으로 만든 멋진 첫 화면에 오신 것을 환영해요!")
    st.divider()
    
    col1, col2 = st.columns(2)
    with col1:
        st.write("### 💡 이 앱에 대하여")
        st.write("""
        이곳에는 웹페이지의 소개글이나 사용 방법을 적을 수 있어.
        스트림릿은 복잡한 HTML이나 CSS 없이 파이썬만으로도 
        이렇게 훌륭한 UI를 만들 수 있게 해 주는 아주 강력한 도구야.
        """)
    with col2:
        st.write("### 🛠️ 기능 테스트")
        st.write("간단한 버튼과 입력창을 테스트해 볼 수 있어.")
        user_name = st.text_input("이름을 입력해 보세요!")
        if st.button("인사하기"):
            if user_name:
                st.success(f"반가워요, {user_name}님! 멋진 프로그래밍을 응원할게요!")
            else:
                st.warning("이름을 먼저 입력해 주세요.")

# ==========================================
# 2. 업다운 게임 페이지
# ==========================================
def game_page():
    st.title("🎮 업다운(Up-Down) 게임")
    st.write("컴퓨터가 1부터 100 사이의 숫자 하나를 생각했습니다. 맞춰보세요!")

    if "target_number" not in st.session_state:
        st.session_state.target_number = random.randint(1, 100)
        st.session_state.game_over = False
        st.session_state.attempts = 0

    with st.form(key="updown_form", clear_on_submit=False):
        user_input = st.text_input("숫자를 입력하고 엔터를 누르세요 (1~100)")
        submit_button = st.form_submit_button(label="정답 확인")

    if submit_button:
        if user_input.isdigit():
            user_guess = int(user_input)
            
            if not st.session_state.game_over:
                st.session_state.attempts += 1
                
                if user_guess < st.session_state.target_number:
                    st.info(f"🔺 UP! 컴퓨터가 생각한 숫자가 더 큽니다. (시도 횟수: {st.session_state.attempts}회)")
                elif user_guess > st.session_state.target_number:
                    st.info(f"🔻 DOWN! 컴퓨터가 생각한 숫자가 더 작습니다. (시도 횟수: {st.session_state.attempts}회)")
                else:
                    st.success(f"🎉 정답입니다! {st.session_state.attempts}번 만에 맞추셨습니다!")
                    st.session_state.game_over = True
            else:
                st.warning("게임이 끝났습니다. 새로운 게임을 시작하려면 아래 재시작 버튼을 눌러주세요.")
        else:
            st.error("숫자만 정확하게 입력해 주세요!")

    if st.button("게임 재시작"):
        st.session_state.target_number = random.randint(1, 100)
        st.session_state.game_over = False
        st.session_state.attempts = 0
        st.rerun()

# ==========================================
# 3. 뱀사다리 말판 게임 페이지
# ==========================================
def board_page():
    st.title("🎲 뱀사다리 말판 게임 (1~50)")
    st.write("주사위를 굴려 가장 먼저 50번 칸에 도착하는 사람이 승리합니다!")
    
    ladders = {3: 15, 12: 28, 20: 34, 31: 43}
    snakes = {18: 6, 32: 10, 41: 25, 48: 22}
    emojis = ["🔴", "🔵", "🟡", "🟢"]

    if "board_players" not in st.session_state:
        st.session_state.board_players = 2
    if "positions" not in st.session_state:
        st.session_state.positions = [1, 1, 1, 1]
    if "turn" not in st.session_state:
        st.session_state.turn = 0
    if "log" not in st.session_state:
        st.session_state.log = ["게임을 시작합니다!"]
    if "winner" not in st.session_state:
        st.session_state.winner = None
    if "custom_names" not in st.session_state:
        st.session_state.custom_names = ["플레이어 1", "플레이어 2", "플레이어 3", "플레이어 4"]

    st.subheader("👥 게임 인원 및 이름 설정")
    new_num_players = st.selectbox("참여할 플레이어 수를 선택하세요", [2, 3, 4], index=st.session_state.board_players - 2, key="board_p_select")
    
    if new_num_players != st.session_state.board_players:
        st.session_state.board_players = new_num_players
        st.session_state.positions = [1, 1, 1, 1]
        st.session_state.turn = 0
        st.session_state.log = ["인원이 변경되어 게임을 리셋합니다!"]
        st.session_state.winner = None
        st.rerun()

    name_cols = st.columns(st.session_state.board_players)
    for i in range(st.session_state.board_players):
        with name_cols[i]:
            st.session_state.custom_names[i] = st.text_input(f"{emojis[i]} 이름 입력", value=st.session_state.custom_names[i], key=f"p_name_{i}")

    display_names = [f"{emojis[i]} {st.session_state.custom_names[i]}" for i in range(st.session_state.board_players)]

    st.divider()

    st.subheader("🗺️ 실시간 게임 보드판")
    board_html = "<div style='display: grid; grid-template-columns: repeat(10, 1fr); gap: 6px; background-color: #f5f5f5; padding: 15px; border-radius: 12px; border: 2px solid #ccc; max-width: 900px; margin: auto;'>"
    
    for r in range(4, -1, -1):
        for c in range(10):
            num = r * 10 + 1 + c if r % 2 == 0 else r * 10 + 10 - c
            
            present_players = ""
            for p_idx in range(st.session_state.board_players):
                if st.session_state.positions[p_idx] == num:
                    present_players += emojis[p_idx]
            
            bg_color = "#ffffff"
            note = ""
            border_style = "1px solid #ddd"
            
            if num == 1:
                bg_color = "#fff9db"
                note = "START"
                border_style = "2px solid #fcc419"
            elif num == 50:
                bg_color = "#e3fafc"
                note = "GOAL"
                border_style = "2px solid #22b8cf"
            elif num in ladders:
                note = f"🪜 ➔ {ladders[num]}"
                bg_color = "#ebfbee"
            elif num in snakes:
                note = f"🐍 ➔ {snakes[num]}"
                bg_color = "#fff5f5"
            
            cell_style = f"background-color: {bg_color}; border: {border_style}; border-radius: 8px; padding: 6px; text-align: center; min-height: 75px; display: flex; flex-direction: column; justify-content: space-between;"
            board_html += f"<div style='{cell_style}'>"
            board_html += f"<div style='font-size: 12px; font-weight: bold; color: #495057; text-align: left;'>{num}</div>"
            board_html += f"<div style='font-size: 18px; margin: 2px 0; min-height: 24px;'>{present_players}</div>"
            board_html += f"<div style='font-size: 9px; color: #868e96; font-weight: bold;'>{note}</div>"
            board_html += "</div>"
            
    board_html += "</div>"
    st.markdown(board_html, unsafe_allow_html=True)

    st.divider()

    cols = st.columns(st.session_state.board_players)
    for i in range(st.session_state.board_players):
        with cols[i]:
            st.metric(label=display_names[i], value=f"{st.session_state.positions[i]}번 칸")

    st.divider()

    if st.session_state.winner:
        st.success(f"🎉 축하합니다! {st.session_state.winner} 팀이 승리했습니다!")
    else:
        st.subheader(f"👉 현재 차례: {display_names[st.session_state.turn]}")
        if st.button("🎲 주사위 던지기", key="roll_dice_btn"):
            dice_roll = random.randint(1, 6)
            old_pos = st.session_state.positions[st.session_state.turn]
            new_pos = old_pos + dice_roll
            log_msg = f"{display_names[st.session_state.turn]}이(가) 주사위 {dice_roll}을(를) 굴렸습니다. ({old_pos} ➔ {new_pos})"
            
            if new_pos >= 50:
                st.session_state.positions[st.session_state.turn] = 50
                st.session_state.winner = display_names[st.session_state.turn]
                st.session_state.log.insert(0, log_msg + " 🏁 골인!!")
            else:
                if new_pos in ladders:
                    log_msg += f" 🪜 사다리! {new_pos}번에서 {ladders[new_pos]}번으로 이동!"
                    new_pos = ladders[new_pos]
                elif new_pos in snakes:
                    log_msg += f" 🐍 뱀이다! {new_pos}번에서 {snakes[new_pos]}번으로 미끄러짐..."
                    new_pos = snakes[new_pos]
                
                st.session_state.positions[st.session_state.turn] = new_pos
                st.session_state.log.insert(0, log_msg)
                st.session_state.turn = (st.session_state.turn + 1) % st.session_state.board_players
            st.rerun()

    if st.button("🔄 게임 처음부터 다시 시작", key="reset_board_btn"):
        st.session_state.positions = [1, 1, 1, 1]
        st.session_state.turn = 0
        st.session_state.log = ["게임을 리셋했습니다!"]
        st.session_state.winner = None
        st.rerun()

    for msg in st.session_state.log[:5]:
        st.write(msg)


# ==========================================
# 4. 쿼리도 두뇌 게임 페이지
# ==========================================
def check_path(start, p_idx, num_p, h_walls, v_walls):
    queue = [start]
    visited = {tuple(start)}
    while queue:
        r, c = queue.pop(0)
        if p_idx == 0 and r == 0: return True
        if p_idx == 1 and r == 8: return True
        if p_idx == 2 and c == 8: return True
        if p_idx == 3 and c == 0: return True
        
        if r > 0 and (r-1, c) not in visited and not h_walls[r-1][c]:
            visited.add((r-1, c))
            queue.append([r-1, c])
        if r < 8 and (r+1, c) not in visited and not h_walls[r][c]:
            visited.add((r+1, c))
            queue.append([r+1, c])
        if c > 0 and (r, c-1) not in visited and not v_walls[r][c-1]:
            visited.add((r, c-1))
            queue.append([r, c-1])
        if c < 8 and (r, c+1) not in visited and not v_walls[r][c]:
            visited.add((r, c+1))
            queue.append([r, c+1])
    return False

def check_all_paths(positions, num_p, h_walls, v_walls):
    for i in range(num_p):
        if not check_path(positions[i], i, num_p, h_walls, v_walls):
            return False
    return True

def quoridor_page():
    st.title("🧱 🧠 전략 두뇌 게임: 쿼리도")
    emojis = ["🔴", "🔵", "🟡", "🟢"]
    
    if "q_players" not in st.session_state: st.session_state.q_players = 2
    if "q_positions" not in st.session_state: st.session_state.q_positions = [[8, 4], [0, 4], [4, 0], [4, 8]]
    if "q_walls_h" not in st.session_state: st.session_state.q_walls_h = [[False]*9 for _ in range(8)]
    if "q_walls_v" not in st.session_state: st.session_state.q_walls_v = [[False]*8 for _ in range(9)]
    if "q_wall_counts" not in st.session_state: st.session_state.q_wall_counts = [10, 10, 5, 5]
    if "q_turn" not in st.session_state: st.session_state.q_turn = 0
    if "q_winner" not in st.session_state: st.session_state.q_winner = None
    if "q_names" not in st.session_state: st.session_state.q_names = ["플레이어 1", "플레이어 2", "플레이어 3", "플레이어 4"]
    if "q_log" not in st.session_state: st.session_state.q_log = ["게임을 시작합니다!"]

    new_num = st.selectbox("참여할 플레이어 수를 선택하세요", [2, 4], index=0 if st.session_state.q_players == 2 else 1, key="q_p_select")
    if new_num != st.session_state.q_players:
        st.session_state.q_players = new_num
        st.session_state.q_positions = [[8, 4], [0, 4], [4, 0], [4, 8]]
        st.session_state.q_walls_h = [[False]*9 for _ in range(8)]
        st.session_state.q_walls_v = [[False]*8 for _ in range(9)]
        st.session_state.q_wall_counts = [10, 10, 5, 5] if new_num == 2 else [5, 5, 5, 5]
        st.session_state.q_turn = 0
        st.session_state.q_winner = None
        st.rerun()

    name_cols = st.columns(st.session_state.q_players)
    for i in range(st.session_state.q_players):
        st.session_state.q_names[i] = name_cols[i].text_input(f"{emojis[i]} 이름", value=st.session_state.q_names[i], key=f"q_name_{i}")

    st.divider()
    
    board_html = "<div style='display: grid; grid-template-columns: repeat(9, 1fr); gap: 0px; background-color: #343a40; padding: 12px; border-radius: 12px; max-width: 450px; margin: auto;'>"
    for r in range(9):
        for c in range(9):
            cell_p = ""
            for p_idx in range(st.session_state.q_players):
                if st.session_state.q_positions[p_idx] == [r, c]: cell_p = emojis[p_idx]
            b_bottom = "2px solid #495057"
            b_right = "2px solid #495057"
            if r < 8 and st.session_state.q_walls_h[r][c]: b_bottom = "6px solid #ff8787"
            if c < 8 and st.session_state.q_walls_v[r][c]: b_right = "6px solid #ff8787"
            bg = "#212529"
            if r == 0: bg = "#2b3b4c"
            elif r == 8: bg = "#4c3b2b"
            cell_style = f"background-color: {bg}; border-bottom: {b_bottom}; border-right: {b_right}; width: 100%; aspect-ratio: 1; display: flex; align-items: center; justify-content: center; font-size: 20px;"
            board_html += f"<div style='{cell_style}'>{cell_p}</div>"
    board_html += "</div>"
    st.markdown(board_html, unsafe_allow_html=True)

    st.divider()
    status_cols = st.columns(st.session_state.q_players)
    for i in range(st.session_state.q_players):
        status_cols[i].metric(label=st.session_state.q_names[i], value=f"벽 {st.session_state.q_wall_counts[i]}개")

    if st.session_state.q_winner:
        st.success(f"🎉 {st.session_state.q_winner}님 승리!")
    else:
        curr = st.session_state.q_turn
        st.subheader(f"👉 차례: {emojis[curr]} {st.session_state.q_names[curr]}")
        action = st.radio("행동", ["말 이동", "벽 설치"], horizontal=True, key="q_act")
        cr, cc = st.session_state.q_positions[curr]
        
        if action == "말 이동":
            m_cols = st.columns(4)
            if m_cols[0].button("⬆️ 위", disabled=not (cr > 0 and not st.session_state.q_walls_h[cr-1][cc]), key="qu"):
                st.session_state.q_positions[curr] = [cr-1, cc]
                if curr == 0 and cr-1 == 0: st.session_state.q_winner = st.session_state.q_names[curr]
                st.session_state.q_turn = (curr + 1) % st.session_state.q_players
                st.rerun()
            if m_cols[1].button("⬇️ 아래", disabled=not (cr < 8 and not st.session_state.q_walls_h[cr][cc]), key="qd"):
                st.session_state.q_positions[curr] = [cr+1, cc]
                if curr == 1 and cr+1 == 8: st.session_state.q_winner = st.session_state.q_names[curr]
                st.session_state.q_turn = (curr + 1) % st.session_state.q_players
                st.rerun()
            if m_cols[2].button("⬅️ 왼쪽", disabled=not (cc > 0 and not st.session_state.q_walls_v[cr][cc-1]), key="ql"):
                st.session_state.q_positions[curr] = [cr, cc-1]
                if curr == 3 and cc-1 == 0: st.session_state.q_winner = st.session_state.q_names[curr]
                st.session_state.q_turn = (curr + 1) % st.session_state.q_players
                st.rerun()
            if m_cols[3].button("➡️ 오른쪽", disabled=not (cc < 8 and not st.session_state.q_walls_v[cr][cc]), key="qr"):
                st.session_state.q_positions[curr] = [cr, cc+1]
                if curr == 2 and cc+1 == 8: st.session_state.q_winner = st.session_state.q_names[curr]
                st.session_state.q_turn = (curr + 1) % st.session_state.q_players
                st.rerun()
        else:
            w_type = st.selectbox("종류", ["가로 벽", "세로 벽"])
            w_row = st.number_input("행 (1~8)", 1, 8, 1) - 1
            w_col = st.number_input("열 (1~8)", 1, 8, 1) - 1
            if st.button("🧱 벽 설치"):
                ok = False
                if "가로" in w_type:
                    if not st.session_state.q_walls_h[w_row][w_col] and not st.session_state.q_walls_h[w_row][w_col+1]:
                        st.session_state.q_walls_h[w_row][w_col] = True
                        st.session_state.q_walls_h[w_row][w_col+1] = True
                        if check_all_paths(st.session_state.q_positions, st.session_state.q_players, st.session_state.q_walls_h, st.session_state.q_walls_v): ok = True
                        else:
                            st.session_state.q_walls_h[w_row][w_col] = False
                            st.session_state.q_walls_h[w_row][w_col+1] = False
                else:
                    if not st.session_state.q_walls_v[w_row][w_col] and not st.session_state.q_walls_v[w_row+1][w_col]:
                        st.session_state.q_walls_v[w_row][w_col] = True
                        st.session_state.q_walls_v[w_row+1][w_col] = True
                        if check_all_paths(st.session_state.q_positions, st.session_state.q_players, st.session_state.q_walls_h, st.session_state.q_walls_v): ok = True
                        else:
                            st.session_state.q_walls_v[w_row][w_col] = False
                            st.session_state.q_walls_v[w_row+1][w_col] = False
                if ok:
                    st.session_state.q_wall_counts[curr] -= 1
                    st.session_state.q_turn = (curr + 1) % st.session_state.q_players
                    st.rerun()
                else: st.error("벽을 놓을 수 없거나 길을 완전히 막습니다!")


# ==========================================
# 5. RPG 게임 도우미 데이터 & 함수
# ==========================================
SAVE_FILE = "rpg_save_data.json"

# 글로벌 스킬 사전 정의 데이터베이스
ALL_SKILLS = {
    "⚡ 질풍 연격": {"price": 250, "cd": 2, "desc": "신속하게 2단 타격! 공격력의 1.8배 대미지"},
    "🔱 성운 붕괴 폭발": {"price": 850, "cd": 4, "desc": "적 방어력을 100% 무시하고 공격력의 3.2배 고정 대미지"},
    "💖 흡혈귀의 군주": {"price": 500, "cd": 3, "desc": "적에게 1.3배의 피해를 주고, 가한 피해량의 40%만큼 체력 회복"},
    "🛡️ 갓 가디언 실드": {"price": 400, "cd": 3, "desc": "적에게 0.8배 피해를 입히고, 자신의 체력을 60만큼 즉시 치유"},
    "🎯 백발백중 신성창": {"price": 1200, "cd": 3, "desc": "급소를 관통해 공격력의 2.6배 대미지 부여"}
}

def save_rpg():
    data = {
        "lvl": st.session_state.r_lvl,
        "exp": st.session_state.r_exp,
        "max_exp": st.session_state.r_max_exp,
        "gold": st.session_state.r_gold,
        "max_hp": st.session_state.r_max_hp,
        "hp": st.session_state.r_hp,
        "b_atk": st.session_state.r_b_atk,
        "b_def": st.session_state.r_b_def,
        "w_name": st.session_state.r_w_name,
        "w_atk": st.session_state.r_w_atk,
        "w_enhance": st.session_state.r_w_enhance,
        "a_name": st.session_state.r_a_name,
        "a_def": st.session_state.r_a_def,
        "a_enhance": st.session_state.r_a_enhance,
        "skills_owned": st.session_state.r_skills_owned,
        "skills_equipped": st.session_state.r_skills_equipped
    }
    with open(SAVE_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=4)

def load_rpg():
    if os.path.exists(SAVE_FILE):
        with open(SAVE_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        st.session_state.r_lvl = data.get("lvl", 1)
        st.session_state.r_exp = data.get("exp", 0)
        st.session_state.r_max_exp = data.get("max_exp", 10)
        st.session_state.r_gold = data.get("gold", 50)
        st.session_state.r_max_hp = data.get("max_hp", 60)
        st.session_state.r_hp = data.get("hp", 60)
        st.session_state.r_b_atk = data.get("b_atk", 10)
        st.session_state.r_b_def = data.get("b_def", 2)
        st.session_state.r_w_name = data.get("w_name", "낡은 나뭇가지")
        st.session_state.r_w_atk = data.get("w_atk", 0)
        st.session_state.r_w_enhance = data.get("w_enhance", 0)
        st.session_state.r_a_name = data.get("a_name", "천 옷")
        st.session_state.r_a_def = data.get("a_def", 0)
        st.session_state.r_a_enhance = data.get("a_enhance", 0)
        st.session_state.r_skills_owned = data.get("skills_owned", [])
        st.session_state.r_skills_equipped = data.get("skills_equipped", [])
        return True
    return False

def enemy_turn_process(m, total_def):
    # 전장에 장착하고 들어온 스킬들의 개별 쿨타임 관리
    for s_name in st.session_state.r_cds:
        if st.session_state.r_cds[s_name] > 0:
            st.session_state.r_cds[s_name] -= 1

    # 1. 보스 몬스터 사망 판정
    if m["hp"] <= 0:
        st.session_state.r_battle = False
        st.session_state.r_gold += m["gold"]
        st.session_state.r_exp += m["exp"]
        st.session_state.r_log.insert(0, f"🏆 [보스 토벌 대성공] {m['name']} 클리어! 보상: 💰 {m['gold']}G / ✨ {m['exp']}EXP")
        
        # 레벨업 판정
        if st.session_state.r_exp >= st.session_state.r_max_exp:
            st.session_state.r_lvl += 1
            st.session_state.r_exp -= st.session_state.r_max_exp
            st.session_state.r_max_exp = int(st.session_state.r_max_exp * 1.5)
            st.session_state.r_max_hp += 35
            st.session_state.r_b_atk += 8
            st.session_state.r_b_def += 5
            st.session_state.r_hp = st.session_state.r_max_hp
            st.session_state.r_log.insert(0, f"🎉 LEVEL UP! Lv.{st.session_state.r_lvl} 달성! 최대 체력 및 기초 공격/방어 스탯 상승.")
        save_rpg()
        return

    # 2. 보스의 반격 턴
    m_dmg = max(1, m["atk"] - total_def)
    st.session_state.r_hp -= m_dmg
    st.session_state.r_log.insert(0, f"💥 [{m['name']}]의 위협적인 반격! {m_dmg}의 대미지를 입었습니다.")

    # 3. 용사 사망 판정
    if st.session_state.r_hp <= 0:
        st.session_state.r_battle = False
        st.session_state.r_hp = int(st.session_state.r_max_hp * 0.3) # 30% 체력으로 복귀
        p_lost = int(st.session_state.r_gold * 0.1) # 10% 골드 패널티
        st.session_state.r_gold -= p_lost
        st.session_state.r_log.insert(0, f"💀 전사하셨습니다... 안전지대에서 부활했습니다. 패널티로 소지 골드 가치가 감소합니다 (-{p_lost}G)")
        save_rpg()


# ==========================================
# 6. 메인 RPG 게임 화면 페이지
# ==========================================
def rpg_page():
    st.title("⚔️ 전설의 용사 키우기 (Ver 3.0 Custom)")
    st.write("자신만의 스킬셋을 세팅하고 장비를 한계까지 강화하여 10대 군주 보스들을 처단하세요!")

    # 세션 상태 안전 개별 초기화 딕셔너리
    defaults = {
        "r_lvl": 1,
        "r_exp": 0,
        "r_max_exp": 10,
        "r_gold": 100,
        "r_max_hp": 60,
        "r_hp": 60,
        "r_b_atk": 10,
        "r_b_def": 2,
        "r_w_name": "낡은 나뭇가지",
        "r_w_atk": 0,
        "r_w_enhance": 0,
        "r_a_name": "천 옷",
        "r_a_def": 0,
        "r_a_enhance": 0,
        "r_skills_owned": [],
        "r_skills_equipped": [],
        "r_cds": {},
        "r_log": ["새로운 월드에 오신 것을 환영합니다."],
        "r_battle": False,
        "m_cur": None
    }

    for key, value in defaults.items():
        if key not in st.session_state:
            st.session_state[key] = value

    # [💡 고품질 스탯 계산 공식] 강화 수치를 적용한 동적 수치 계산
    # 무기강화당 ATK +8, 방어구강화당 DEF +5 보너스 가산
    enhance_atk_bonus = st.session_state.r_w_enhance * 8
    enhance_def_bonus = st.session_state.r_a_enhance * 5
    
    total_atk = st.session_state.r_b_atk + st.session_state.r_w_atk + enhance_atk_bonus
    total_def = st.session_state.r_b_def + st.session_state.r_a_def + enhance_def_bonus

    # 대시보드 UI 프로필 스탯 노출
    st.subheader("👤 용사 스탯 멀티 정보창")
    c1, c2, c3, c4 = st.columns(4)
    c1.metric("종합 레벨", f"Lv.{st.session_state.r_lvl}")
    c2.metric("자금 잔고", f"💰 {st.session_state.r_gold} G")
    
    w_enh_text = f"(+{st.session_state.r_w_enhance})" if st.session_state.r_w_enhance > 0 else ""
    c3.metric("총 공격력", f"⚔️ {total_atk}", f"기본+{st.session_state.r_w_atk} {w_enh_text}")
    
    a_enh_text = f"(+{st.session_state.r_a_enhance})" if st.session_state.r_a_enhance > 0 else ""
    c4.metric("총 방어력", f"🛡️ {total_def}", f"기본+{st.session_state.r_a_def} {a_enh_text}")

    st.write(f"❤️ **HP 게이지:** {st.session_state.r_hp} / {st.session_state.r_max_hp}")
    st.progress(max(0.0, min(1.0, st.session_state.r_hp / st.session_state.r_max_hp)))
    st.write(f"✨ **경험치 잔량:** {st.session_state.r_exp} / {st.session_state.r_max_exp}")
    st.progress(max(0.0, min(1.0, st.session_state.r_exp / st.session_state.r_max_exp)))

    st.divider()

    tab1, tab2, tab3, tab4 = st.tabs([
        "🏹 10대 정예 보스 토벌", 
        "🛒 무기/방어구 대장간 & 강화소", 
        "📜 스킬 커스텀 및 무공 관리실", 
        "💾 모험의 서 파일 입출력"
    ])

    # ------------------------------------------
    # Tab 1: 10마리의 순차적 랜드마크 보스 레이드
    # ------------------------------------------
    with tab1:
        boss_ladder = {
            "👹 [BOSS 01] 하급 슬라임 킹": {"hp": 60, "atk": 12, "def": 2, "exp": 5, "gold": 40},
            "🐺 [BOSS 02] 광포한 우두머리 늑대": {"hp": 180, "atk": 25, "def": 8, "exp": 15, "gold": 120},
            "🦂 [BOSS 03] 사막의 맹독 지배자": {"hp": 450, "atk": 50, "def": 22, "exp": 40, "gold": 300},
            "🧟 [BOSS 04] 저주받은 백골 기사관": {"hp": 1100, "atk": 95, "def": 48, "exp": 90, "gold": 750},
            "🤖 [BOSS 05] 무너진 고대 문명 수호 기갑": {"hp": 2400, "atk": 180, "def": 90, "exp": 200, "gold": 1500},
            "🦅 [BOSS 06] 천공의 오염된 하피 퀸": {"hp": 5000, "atk": 320, "def": 170, "exp": 450, "gold": 3000},
            "🌋 [BOSS 07] 지옥 심연의 용암 고렘": {"hp": 11000, "atk": 540, "def": 310, "exp": 1000, "gold": 5000},
            "❄️ [BOSS 08] 영구 동토의 서리 마녀": {"hp": 24000, "atk": 880, "def": 520, "exp": 2200, "gold": 8000},
            "👑 [BOSS 09] 타락한 황실 영혼 군주": {"hp": 55000, "atk": 1450, "def": 850, "exp": 5000, "gold": 12000},
            "🔥 [BOSS 10] 세계선 종언의 성광 드래곤": {"hp": 120000, "atk": 2500, "def": 1400, "exp": 20000, "gold": 30000}
        }

        if not st.session_state.r_battle:
            st.write("### 🏹 도전할 보스 대상을 선택하십시오:")
            b_choice = st.selectbox("전설급 보스 리스트업", list(boss_ladder.keys()))
            
            equipped_count = len(st.session_state.r_skills_equipped)
            st.info(f"현재 전투용 슬롯에 배치된 스킬 수: **{equipped_count}개** (최대 2개 배치 가능)")
            
            if st.button("⚔️ 보스 결계 룸 진입하기"):
                st.session_state.m_cur = boss_ladder[b_choice].copy()
                st.session_state.m_cur["name"] = b_choice
                st.session_state.m_cur["max_hp"] = boss_ladder[b_choice]["hp"]
                st.session_state.r_battle = True
                
                # 진입 시 전투에 세팅된 스킬의 쿨타임 컴포넌트 초기화
                st.session_state.r_cds = {s: 0 for s in st.session_state.r_skills_equipped}
                st.session_state.r_log.insert(0, f"⚔️ {b_choice}의 진영에 난입했습니다! 生과 死의 전투가 전개됩니다.")
                st.rerun()
        else:
            m = st.session_state.m_cur
            st.error(f"👿 극도로 위협적인 보스 **{m['name']}** 와 혈투 중!")
            st.write(f"💥 **보스 잔여 체력:** {m['hp']} / {m['max_hp']}")
            st.progress(max(0.0, min(1.0, m["hp"] / m["max_hp"])))

            # 장착된 스킬의 개수에 맞춰 다이내믹하게 버튼 가로 레이아웃 배치 (기본 공격 1개 + 장착 스킬 수)
            num_buttons = 1 + len(st.session_state.r_skills_equipped)
            btn_cols = st.columns(num_buttons + 1) # 퇴각 버튼 공간 하나 추가
            
            # 1. 기본 공격 버튼
            if btn_cols[0].button("🗡️ 평타 공격", use_container_width=True):
                p_dmg = max(1, total_atk - m["def"])
                m["hp"] -= p_dmg
                st.session_state.r_log.insert(0, f"⚔️ 용사의 일격! [{m['name']}]에게 {p_dmg}의 대미지 적중.")
                enemy_turn_process(m, total_def)
                st.rerun()

            # 2. 유저가 커스텀하게 장착하고 들어온 스킬 버튼들 동적 배치
            for idx, s_name in enumerate(st.session_state.r_skills_equipped):
                cd_val = st.session_state.r_cds.get(s_name, 0)
                btn_label = f"{s_name}"
                if cd_val > 0:
                    btn_label += f" ({cd_val}턴 대기)"
                
                is_disabled = cd_val > 0
                if btn_cols[idx + 1].button(btn_label, disabled=is_disabled, use_container_width=True):
                    # 각 스킬 이름별 실시간 메커니즘 연산식 분기 처리
                    p_dmg = 0
                    log_text = ""
                    
                    if s_name == "⚡ 질풍 연격":
                        p_dmg = max(1, int(total_atk * 1.8) - m["def"])
                        log_text = f"⚡ [질풍 연격 시전] 신속하게 두 번 베어 {p_dmg}의 큰 대미지를 날렸습니다!"
                    elif s_name == "🔱 성운 붕괴 폭발":
                        p_dmg = int(total_atk * 3.2) # 방어 100% 무시
                        log_text = f"🔱 [성운 붕괴 폭발 시전] 장갑을 완전 무시하고 {p_dmg}의 치명적 고정 피해를 선사했습니다!"
                    elif s_name == "💖 흡혈귀의 군주":
                        p_dmg = max(1, int(total_atk * 1.3) - m["def"])
                        heal_amt = int(p_dmg * 0.4)
                        st.session_state.r_hp = min(st.session_state.r_max_hp, st.session_state.r_hp + heal_amt)
                        log_text = f"💖 [흡혈귀의 군주 시전] 적에게 {p_dmg} 피해를 입히고 내 체력을 +{heal_amt} 흡수했습니다!"
                    elif s_name == "🛡️ 갓 가디언 실드":
                        p_dmg = max(1, int(total_atk * 0.8) - m["def"])
                        st.session_state.r_hp = min(st.session_state.r_max_hp, st.session_state.r_hp + 60)
                        log_text = f"🛡️ [갓 가디언 실드 시전] 방어막을 쳐 {p_dmg} 피해를 주고 체력을 즉시 +60 치유했습니다."
                    elif s_name == "🎯 백발백중 신성창":
                        p_dmg = max(1, int(total_atk * 2.6) - m["def"])
                        log_text = f"🎯 [백발백중 신성창 시전] 적의 급소에 일격을 꽂아 {p_dmg}의 치명타를 주었습니다."
                    
                    m["hp"] -= p_dmg
                    st.session_state.r_cds[s_name] = ALL_SKILLS[s_name]["cd"]
                    st.session_state.r_log.insert(0, log_text)
                    enemy_turn_process(m, total_def)
                    st.rerun()

            # 마지막 칸 퇴각 단추 배치
            if btn_cols[-1].button("🏃 도망치기", use_container_width=True):
                st.session_state.r_battle = False
                st.session_state.r_log.insert(0, "💨 위협적인 기운에 밀려 전투에서 이탈했습니다.")
                st.rerun()

    # ------------------------------------------
    # Tab 2: 상점 보급소 & 장비 인챈트 강화 시스템
    # ------------------------------------------
    with tab2:
        st.subheader("🛒 최고급 장비 보급 대장간")
        st.write("골드를 지불해 더욱 강력한 등급의 장비를 영구 교체 획득할 수 있습니다.")
        
        # 10,000원 아이템을 종결로 하는 균형 잡힌 무기 상점 데이터
        w_shop = [
            {"name": "⚔️ 단단한 정련 철검", "atk": 20, "price": 150},
            {"name": "🔱 마력을 주입한 창", "atk": 65, "price": 600},
            {"name": "☄️ 성광의 천공 대검", "atk": 160, "price": 2000},
            {"name": "🔥 드래곤 오리진 슬레이어", "atk": 380, "price": 5000},
            {"name": "🌌 종언을 고하는 창조의 검", "atk": 850, "price": 10000}
        ]
        
        # 10,000원 아이템을 종결로 하는 균형 잡힌 방어구 상점 데이터
        a_shop = [
            {"name": "🧥 야전 이중 가죽갑옷", "def": 10, "price": 180},
            {"name": "⛓️ 팔라딘 중전 사슬갑", "def": 35, "price": 650},
            {"name": "🔱 티타늄 풀플레이트 아머", "def": 90, "price": 2200},
            {"name": "🌌 오로라 불멸의 성해 아머", "def": 210, "price": 5200},
            {"name": "👑 절대존엄 성황의 천신갑", "def": 480, "price": 10000}
        ]

        st.write(f"현재 무기: **{st.session_state.r_w_name}** | 현재 방어구: **{st.session_state.r_a_name}**")
        
        w_tab, a_tab, enh_tab = st.tabs(["⚔️ 무기 상점", "🛡️ 방어구 상점", "💎 장비 강화소"])
        
        with w_tab:
            wc = st.columns(len(w_shop))
            for i, w in enumerate(w_shop):
                with wc[i]:
                    st.write(f"**{w['name']}**")
                    st.caption(f"공격력 +{w['atk']}")
                    if st.button(f"구매 💰{w['price']}G", key=f"buy_w_{i}"):
                        if st.session_state.r_gold >= w['price']:
                            st.session_state.r_gold -= w['price']
                            st.session_state.r_w_name = w['name']
                            st.session_state.r_w_atk = w['atk']
                            st.session_state.r_w_enhance = 0 # 새 무기 장착 시 강화도 초기화
                            st.session_state.r_log.insert(0, f"🛒 무기를 [{w['name']}]으로 전면 교체 장착했습니다.")
                            save_rpg()
                            st.rerun()
                        else: st.error("소지 골드가 부족합니다.")
                        
        with a_tab:
            ac = st.columns(len(a_shop))
            for i, a in enumerate(a_shop):
                with ac[i]:
                    st.write(f"**{a['name']}**")
                    st.caption(f"방어력 +{a['def']}")
                    if st.button(f"구매 💰{a['price']}G", key=f"buy_a_{i}"):
                        if st.session_state.r_gold >= a['price']:
                            st.session_state.r_gold -= a['price']
                            st.session_state.r_a_name = a['name']
                            st.session_state.r_a_def = a['def']
                            st.session_state.r_a_enhance = 0 # 새 방어구 장착 시 강화도 초기화
                            st.session_state.r_log.insert(0, f"🛒 방어구를 [{a['name']}]으로 전면 교체 착용했습니다.")
                            save_rpg()
                            st.rerun()
                        else: st.error("소지 골드가 부족합니다.")

        # [🔥 신규 핵심 기능] 장비 주문서 골드 강화 시스템 단락
        with enh_tab:
            st.write("### 💎 축복받은 장비 인챈트 제단")
            st.write("보유하고 있는 주무기와 방어구에 골드를 헌사하여 추가 한계 강화를 진행합니다.")
            st.warning("⚠️ 주의: 새 장비를 구매하면 기존 장비의 주문서 강화 수치는 사라지고 계승되지 않습니다!")
            
            # 강화 비용 공식: (현재강화레벨 + 1) * 200 골드 균형 패치
            w_cost = (st.session_state.r_w_enhance + 1) * 200
            a_cost = (st.session_state.r_a_enhance + 1) * 200
            
            ec1, ec2 = st.columns(2)
            with ec1:
                st.write(f"#### 무기 강화: (+{st.session_state.r_w_enhance}) ➔ (+{st.session_state.r_w_enhance+1})")
                st.caption(f"강화 보너스 효과: 총 공격력 **+8 추가 상승**")
                if st.button(f"⚔️ 무기 강화하기 (💰 {w_cost} G)", use_container_width=True):
                    if st.session_state.r_gold >= w_cost:
                        st.session_state.r_gold -= w_cost
                        # 85% 확률 성공 시스템 탑재 (실패해도 무기가 부서지지는 않고 골드만 소모되어 안전)
                        if random.random() < 0.85:
                            st.session_state.r_w_enhance += 1
                            st.session_state.r_log.insert(0, f"✨ [강화 대성공] 무기가 더욱 날카로워져 (+{st.session_state.r_w_enhance})강 상태가 되었습니다!")
                        else:
                            st.session_state.r_log.insert(0, f"❌ [강화 실패] 제단의 기류가 불안정하여 강화에 실패했습니다. (장비 손상 없음)")
                        save_rpg()
                        st.rerun()
                    else: st.error("강화 비용 골드가 모자랍니다.")

            with ec2:
                st.write(f"#### 방어구 강화: (+{st.session_state.r_a_enhance}) ➔ (+{st.session_state.r_a_enhance+1})")
                st.caption(f"강화 보너스 효과: 총 방어력 **+5 추가 상승**")
                if st.button(f"🛡️ 방어구 강화하기 (💰 {a_cost} G)", use_container_width=True):
                    if st.session_state.r_gold >= a_cost:
                        st.session_state.r_gold -= a_cost
                        if random.random() < 0.85:
                            st.session_state.r_a_enhance += 1
                            st.session_state.r_log.insert(0, f"✨ [강화 대성공] 방어구가 강화되어 (+{st.session_state.r_a_enhance})강 코팅이 완료되었습니다!")
                        else:
                            st.session_state.r_log.insert(0, f"❌ [강화 실패] 제단의 충격 완화에 실패하여 강화도가 유지되었습니다.")
                        save_rpg()
                        st.rerun()
                    else: st.error("강화 비용 골드가 모자랍니다.")

        st.divider()
        if st.button("💖 성수 엘릭서 캔 드링크 (전체 회복) | 💰 20 G"):
            if st.session_state.r_gold >= 20:
                if st.session_state.r_hp == st.session_state.r_max_hp:
                    st.warning("이미 활력이 가득 차 있어 복용이 불가능합니다.")
                else:
                    st.session_state.r_gold -= 20
                    st.session_state.r_hp = st.session_state.r_max_hp
                    st.session_state.r_log.insert(0, "🧪 엘릭서 수액을 마시고 컨디션을 완전히 충전했습니다.")
                    save_rpg()
                    st.rerun()
            else: st.error("골드가 부족합니다.")

    # ------------------------------------------
    # Tab 3: 스킬 구매 및 동적 장착/해제 세팅실
    # ------------------------------------------
    with tab3:
        st.subheader("📜 영웅 무공 비급 구매소")
        st.write("새로운 고위 마법 및 물리 연격 기술들을 구매해 도서관에 보관하세요.")
        
        sc = st.columns(len(ALL_SKILLS))
        for idx, (s_name, s_info) in enumerate(ALL_SKILLS.items()):
            with sc[idx]:
                st.write(f"**{s_name}**")
                st.caption(s_info["desc"])
                st.caption(f"쿨타임: {s_info['cd']}턴")
                
                if s_name in st.session_state.r_skills_owned:
                    st.success("보유 중")
                else:
                    if st.button(f"배우기 💰{s_info['price']}G", key=f"learn_{idx}"):
                        if st.session_state.r_gold >= s_info["price"]:
                            st.session_state.r_gold -= s_info["price"]
                            st.session_state.r_skills_owned.append(s_name)
                            st.session_state.r_log.insert(0, f"📜 비급서 무공 고찰 완료! [{s_name}]을 습득했습니다.")
                            save_rpg()
                            st.rerun()
                        else: st.error("골드가 부족하여 비급을 구매하지 못했습니다.")

        st.divider()
        st.subheader("🛡️ 실시간 전투 무기 커스텀 세팅 (스킬 장착실)")
        st.write("보유한 비급 목록 중 **최대 2개**를 선택하여 전투 퀵슬롯에 직접 세팅할 수 있습니다.")
        
        if not st.session_state.r_skills_owned:
            st.info("아직 습득한 스킬이 존재하지 않습니다. 상단에서 스킬을 먼저 연마해보세요!")
        else:
            st.write(f"현재 장착 완료된 스킬 덱: `{st.session_state.r_skills_equipped}`")
            
            manage_cols = st.columns(len(st.session_state.r_skills_owned))
            for idx, owned_s in enumerate(st.session_state.r_skills_owned):
                with manage_cols[idx]:
                    st.write(f"**{owned_s}**")
                    
                    if owned_s in st.session_state.r_skills_equipped:
                        if st.button("❌ 장착 해제", key=f"unequip_{idx}", use_container_width=True):
                            st.session_state.r_skills_equipped.remove(owned_s)
                            st.session_state.r_log.insert(0, f"⚙️ 전투 슬롯에서 [{owned_s}]을(를) 탈거했습니다.")
                            save_rpg()
                            st.rerun()
                    else:
                        # 2개 꽉 찬 경우 버튼 비활성화 조치
                        slot_full = len(st.session_state.r_skills_equipped) >= 2
                        if st.button("➕ 스킬 장착", key=f"equip_{idx}", disabled=slot_full, use_container_width=True):
                            st.session_state.r_skills_equipped.append(owned_s)
                            st.session_state.r_log.insert(0, f"⚙️ 전투 슬롯 퀵창에 [{owned_s}]을(를) 커스텀 빌드했습니다.")
                            save_rpg()
                            st.rerun()

    # ------------------------------------------
    # Tab 4: 파일 시스템 백업 아카이빙 세션
    # ------------------------------------------
    with tab4:
        st.write("### 💾 영웅 모험 기록 데이터베이스 파일 입출력")
        sm1, sm2 = st.columns(2)
        if sm1.button("💾 데이터 수동 저장하기 (Save)"):
            save_rpg()
            st.success("강화 수치와 보유 및 장착 스킬 테이블이 안전하게 파일 인코딩 저장되었습니다.")
        if sm2.button("📂 데이터 원격 불러오기 (Load)"):
            if load_rpg():
                st.success("모험의 서 세이브 패키지를 전방위 로드하는 데 성공했습니다!")
                st.rerun()
            else: st.error("매칭되는 백업 세이브 데이터 파일(.json)이 식별되지 않습니다.")

    st.divider()
    st.write("### 📜 전투 상황실 하이라이트 배틀로그")
    for log in st.session_state.r_log[:5]:
        st.write(log)


# ==========================================
# 6.5. 워들 퍼즐 게임 페이지
# ==========================================
def check_wordle_guess(target, guess):
    result = [None] * 5
    target_letter_counts = {}
    for char in target:
        target_letter_counts[char] = target_letter_counts.get(char, 0) + 1
        
    # First pass: Green (exact match)
    for i in range(5):
        if guess[i] == target[i]:
            result[i] = 'green'
            target_letter_counts[guess[i]] -= 1
            
    # Second pass: Yellow (exist in target but wrong position) or Gray (not in target)
    for i in range(5):
        if result[i] is None:
            char = guess[i]
            if char in target_letter_counts and target_letter_counts[char] > 0:
                result[i] = 'yellow'
                target_letter_counts[char] -= 1
            else:
                result[i] = 'gray'
    return result

def wordle_page():
    st.title("🔠 워들 (Wordle) 단어 퍼즐")
    st.write("컴퓨터가 생각한 5글자 영어 단어를 6번의 기회 안에 맞춰보세요!")
    
    # 5글자 영어 단어 풀
    WORD_POOL = [
        "APPLE", "HOUSE", "WORLD", "LIGHT", "WATER", "SMART", "BRAIN", "PLANT", "SWEET", "TRAIN", 
        "PIANO", "STORM", "CRANE", "SNAKE", "GRAPE", "CHAIR", "TABLE", "STARS", "CLOCK", "STONE", 
        "SHINE", "DREAM", "FLAME", "GREEN", "NIGHT", "BEACH", "OCEAN", "SMILE", "CLOUD", "BREAD", 
        "FRUIT", "HEART", "PAPER", "SOUND", "VOICE", "PEACE", "TRUTH", "WHITE", "BLACK", "ABOUT", 
        "WRITE", "GUIDE", "PENCIL", "MOUSE", "LOGIC", "CHECK", "BRICK", "BOARD", "GLASS", "SHIRT",
        "TIGER", "HORSE", "SHARK", "LEMON", "HONEY", "MELON", "JUICE", "EARTH", "SPACE", "RIVER",
        "MOUNT", "ROBOT", "MAGIC", "MUSIC", "MOVIE", "FLUTE", "GRASS", "FLOWER", "LEAFY", "HAPPY", 
        "SLEEP", "LUCKY", "CLEAN", "DRINK", "MATCH", "SCORE", "SOUTH", "NORTH", "CANDY"
    ]
    
    # 중복 제거 및 대문자 변환
    WORD_POOL = list(set([w.upper() for w in WORD_POOL]))

    if "w_target" not in st.session_state:
        st.session_state.w_target = random.choice(WORD_POOL)
        st.session_state.w_guesses = []
        st.session_state.w_game_over = False
        st.session_state.w_won = False
        st.session_state.w_error_msg = ""

    # UI 스타일 정의 및 6x5 그리드 렌더링
    st.write(
        """
        <style>
        .wordle-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 8px;
            margin: 20px 0;
        }
        .wordle-row {
            display: flex;
            gap: 8px;
        }
        .wordle-cell {
            width: 55px;
            height: 55px;
            border: 2px solid #565758;
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 26px;
            font-weight: bold;
            text-transform: uppercase;
            color: white;
        }
        .cell-green { background-color: #6aaa64; border-color: #6aaa64; }
        .cell-yellow { background-color: #c9b458; border-color: #c9b458; }
        .cell-gray { background-color: #3a3a3c; border-color: #3a3a3c; }
        .cell-empty { background-color: transparent; border-color: #565758; color: inherit; }

        .keyboard-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 6px;
            margin: 20px 0;
        }
        .keyboard-row {
            display: flex;
            gap: 6px;
        }
        .key {
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 14px;
            font-weight: bold;
            text-transform: uppercase;
            text-align: center;
            min-width: 32px;
        }
        .key-default { background-color: #818384; color: white; }
        .key-green { background-color: #6aaa64; color: white; }
        .key-yellow { background-color: #c9b458; color: white; }
        .key-gray { background-color: #3a3a3c; color: white; }
        </style>
        """,
        unsafe_allow_html=True
    )

    target = st.session_state.w_target
    guesses = st.session_state.w_guesses
    
    # 6x5 그리드 그리기
    grid_html = "<div class='wordle-container'>"
    for row_idx in range(6):
        grid_html += "<div class='wordle-row'>"
        if row_idx < len(guesses):
            guess = guesses[row_idx]
            colors = check_wordle_guess(target, guess)
            for col_idx in range(5):
                char = guess[col_idx]
                color = colors[col_idx]
                grid_html += f"<div class='wordle-cell cell-{color}'>{char}</div>"
        else:
            for col_idx in range(5):
                grid_html += "<div class='wordle-cell cell-empty'></div>"
        grid_html += "</div>"
    grid_html += "</div>"
    
    st.markdown(grid_html, unsafe_allow_html=True)

    # 실시간 키보드 상태 갱신
    letter_states = {chr(i): "default" for i in range(65, 91)}
    for g in guesses:
        colors = check_wordle_guess(target, g)
        for idx, char in enumerate(g):
            current_state = letter_states[char]
            color = colors[idx]
            if color == "green":
                letter_states[char] = "green"
            elif color == "yellow":
                if current_state != "green":
                    letter_states[char] = "yellow"
            elif color == "gray":
                if current_state not in ("green", "yellow"):
                    letter_states[char] = "gray"

    # 가상 키보드 렌더링
    keyboard_rows = [
        ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
        ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
        ["Z", "X", "C", "V", "B", "N", "M"]
    ]
    
    kb_html = "<div class='keyboard-container'>"
    for row in keyboard_rows:
        kb_html += "<div class='keyboard-row'>"
        for key in row:
            state = letter_states[key]
            kb_html += f"<div class='key key-{state}'>{key}</div>"
        kb_html += "</div>"
    kb_html += "</div>"
    
    st.markdown(kb_html, unsafe_allow_html=True)

    st.divider()
    
    if st.session_state.w_game_over:
        if st.session_state.w_won:
            st.success(f"🎉 축하합니다! {len(guesses)}번째 시도 만에 정답 [{target}]을(를) 맞추셨습니다!")
        else:
            st.error(f"😢 아쉽게도 실패했습니다. 컴퓨터가 생각한 단어는 **{target}** 이었습니다.")
    else:
        st.subheader("✍️ 단어 입력")
        with st.form(key="wordle_form", clear_on_submit=True):
            user_input = st.text_input("5글자 영어 단어를 입력하세요 (영어만 가능)", max_chars=5)
            submit_btn = st.form_submit_button("확인")
            
        if submit_btn:
            user_input = user_input.strip().upper()
            if len(user_input) != 5:
                st.session_state.w_error_msg = "⚠️ 반드시 5글자여야 합니다!"
            elif not user_input.isalpha():
                st.session_state.w_error_msg = "⚠️ 알파벳으로만 구성된 단어여야 합니다!"
            else:
                st.session_state.w_error_msg = ""
                st.session_state.w_guesses.append(user_input)
                
                # 결과 확인
                if user_input == target:
                    st.session_state.w_game_over = True
                    st.session_state.w_won = True
                elif len(st.session_state.w_guesses) >= 6:
                    st.session_state.w_game_over = True
                    st.session_state.w_won = False
                st.rerun()
                
        if st.session_state.w_error_msg:
            st.warning(st.session_state.w_error_msg)
            
    if st.button("🔄 새로운 단어로 재시작"):
        if "w_target" in st.session_state: del st.session_state.w_target
        if "w_guesses" in st.session_state: del st.session_state.w_guesses
        if "w_game_over" in st.session_state: del st.session_state.w_game_over
        if "w_won" in st.session_state: del st.session_state.w_won
        if "w_error_msg" in st.session_state: del st.session_state.w_error_msg
        st.rerun()



# ==========================================
# 6.8. 마법학교 신입생의 하루 텍스트 어드벤처
# ==========================================
def update_adv_stats(hp_change=0, mp_change=0, rep_change=0, log_msg=""):
    st.session_state.adv_hp = max(0, min(100, st.session_state.adv_hp + hp_change))
    st.session_state.adv_mp = max(0, min(100, st.session_state.adv_mp + mp_change))
    st.session_state.adv_rep = max(0, min(100, st.session_state.adv_rep + rep_change))
    if log_msg:
        st.session_state.adv_log.insert(0, log_msg)
    
    if st.session_state.adv_hp <= 0:
        st.session_state.adv_step = "ending_hospital"
        st.session_state.adv_log.insert(0, "🏥 [체력 고갈] 과도한 부상과 피로로 정신을 잃고 양로실로 후송되었습니다!")

def adventure_page():
    st.title("🧙 🗺️ 선택형 텍스트 어드벤처: 마법학교 신입생의 하루")
    st.write("선택과 운명(주사위)의 결합! 하루 동안 마법학교의 돌발 상황들을 해결해 나가세요.")
    
    # 데이터 세션 상태 초기화
    if "adv_step" not in st.session_state:
        st.session_state.adv_step = "dorm_morning"
        st.session_state.adv_hp = 100
        st.session_state.adv_mp = 50
        st.session_state.adv_rep = 50
        st.session_state.adv_log = ["마법학교 신입생 모험이 시작되었습니다!"]
        st.session_state.adv_dice_val = None
        st.session_state.adv_temp_step = None

    # 상태창 대시보드
    st.subheader("🎒 마법 신입생 상태창")
    c1, c2, c3 = st.columns(3)
    c1.metric("❤️ 체력 (HP)", f"{st.session_state.adv_hp} / 100")
    c1.progress(max(0.0, min(1.0, st.session_state.adv_hp / 100.0)))
    
    c2.metric("🧪 마력 (Mana)", f"{st.session_state.adv_mp} / 100")
    c2.progress(max(0.0, min(1.0, st.session_state.adv_mp / 100.0)))
    
    c3.metric("🌟 학업 평판 (Reputation)", f"{st.session_state.adv_rep} / 100")
    c3.progress(max(0.0, min(1.0, st.session_state.adv_rep / 100.0)))

    st.divider()

    step = st.session_state.adv_step

    # 각 씬 렌더링 카드 정의
    scenes = {
        # ------------------------------------------
        # 1. 아침 씬
        # ------------------------------------------
        "dorm_morning": {
            "title": "⏰ 기숙사 침대 (오전 8시 30분)",
            "desc": "알람 소리에 눈을 떴습니다! 마법 기초학 첫 수업이 9시에 시작하는데 기숙사 침대입니다. 지금 서두르지 않으면 영락없이 지각입니다! 어떻게 할까요?",
            "type": "choices",
            "options": [
                {"text": "🏃 번개처럼 준비해서 전속력으로 뛰어간다 (체력 -15, 평판 +5)", "action": lambda: (update_adv_stats(hp_change=-15, rep_change=5, log_msg="🏃 지각하지 않기 위해 번개처럼 뛰어가 정시 세이프에 성공했습니다!"), st.session_state.update({"adv_step": "classroom"}), st.rerun())},
                {"text": "🪄 텔레포트 주문서 사용하기 (마력 -10, 주사위 롤 필요)", "action": lambda: (st.session_state.update({"adv_step": "dorm_teleport"}), st.rerun())},
                {"text": "💤 5분만 더 단잠을 청하고 지각한다 (평판 -20)", "action": lambda: (update_adv_stats(rep_change=-20, log_msg="💤 단잠의 대가는 혹독했습니다. 완전히 늦어 지각 확정입니다!"), st.session_state.update({"adv_step": "classroom_late"}), st.rerun())}
            ]
        },
        "dorm_teleport": {
            "title": "🪄 텔레포트 비급 시험",
            "desc": "텔레포트 주문서를 펼쳤습니다. 공간 이동 마법은 아직 서툴러서 성공하려면 <strong>주사위 3 이상</strong>이 나와야 합니다. 2 이하가 나올 경우 공간 차원의 균열로 엉뚱한 곳에 떨어질 수 있습니다!",
            "type": "dice",
            "target": 3,
            "success_step": "classroom",
            "fail_step": "dungeon",
            "success_action": lambda d: update_adv_stats(mp_change=-10, rep_change=10, log_msg=f"🎲 주사위 {d}! 공간 전송 성공! 강의실 앞자리에 폼나게 떨어졌습니다."),
            "fail_action": lambda d: update_adv_stats(hp_change=-20, mp_change=-10, log_msg=f"🎲 주사위 {d}! 대실패! 지옥 차원 균열을 통해 지하 깊은 던전에 떨어졌습니다!")
        },

        # ------------------------------------------
        # 2. 교실 씬 (정상)
        # ------------------------------------------
        "classroom": {
            "title": "🔥 마법 기초 강의실",
            "desc": "아그니 교수님이 불꽃 마법(파이어볼) 소환 시범을 마친 후 실습을 요구하십니다. 붉은 불꽃이 시연 테이블 위에서 춤추고 있습니다. 무엇을 하시겠습니까?",
            "type": "choices",
            "options": [
                {"text": "☄️ 직접 불꽃 마법 시전 연습하기 (마력 -20, 미니 퀴즈 돌입)", "action": lambda: (st.session_state.update({"adv_step": "classroom_quiz"}), st.rerun())},
                {"text": "✍️ 얌전하게 필기하며 모범생인 척하기 (체력 +10, 평판 +15)", "action": lambda: (update_adv_stats(hp_change=10, rep_change=15, log_msg="✍️ 꼼꼼하게 필기하여 교수님의 학구열 칭찬을 받았습니다."), st.session_state.update({"adv_step": "lunch"}), st.rerun())},
                {"text": "💤 책상 밑에서 몰래 쪽잠 자기 (체력 +20, 마력 +10, 평판 -15)", "action": lambda: (update_adv_stats(hp_change=20, mp_change=10, rep_change=-15, log_msg="💤 아그니 교수님이 졸고 있는 당신의 머리맡에 작은 연기 폭탄을 날려 화들짝 잠에서 깼습니다."), st.session_state.update({"adv_step": "lunch"}), st.rerun())}
            ]
        },
        "classroom_quiz": {
            "title": "✏️ 불꽃 주문 퀴즈!",
            "desc": "파이어볼을 소환하기 위해 올바른 영창 단어를 기억해내야 합니다. 다음 중 마법 주문학 책에 나오는 '불꽃 소환' 라틴어 스펠은 무엇일까요?",
            "type": "quiz",
            "question": "Q. '불을 밝히다, 불 지르다'라는 어원을 가진 불꽃 공격 마법의 알맞은 명칭은?",
            "answers": ["Lumos", "Incendio", "Alohomora"],
            "correct_idx": 1,
            "success_action": lambda: update_adv_stats(mp_change=-20, rep_change=20, log_msg="🔥 [정답] Incendio! 주문 시전 성공! 교수님이 당신의 뛰어난 직관에 큰 점수를 주십니다."),
            "fail_action": lambda: update_adv_stats(hp_change=-25, mp_change=-20, rep_change=-10, log_msg="💥 [오답] 주문을 잘못 읊는 바람에 시연용 화로가 폭발하여 얼굴에 검댕이 그을리고 체력이 깎였습니다!"),
            "next_step": "lunch"
        },

        # ------------------------------------------
        # 3. 교실 씬 (지각)
        # ------------------------------------------
        "classroom_late": {
            "title": "🚪 강의실 뒷문 (지각 상황)",
            "desc": "조심스레 강의실 뒷문을 열었으나, 살벌한 눈빛의 아그니 교수님과 눈이 정확히 마주쳤습니다! 강의실 공기가 얼어붙었습니다. 어떻게 대처할까요?",
            "type": "choices",
            "options": [
                {"text": "🙇 90도로 사과하고 방과 후 자율 청소 약속하기 (체력 -10, 평판 -5)", "action": lambda: (update_adv_stats(hp_change=-10, rep_change=-5, log_msg="🙇 솔직한 사과로 징계는 면했지만, 방과 후 실험실 물총 청소가 예약되었습니다."), st.session_state.update({"adv_step": "lunch"}), st.rerun())},
                {"text": "🏃 눈감고 자리에 쏜살같이 대시해 앉기 (주사위 4 이상 필요)", "action": lambda: (st.session_state.update({"adv_step": "classroom_late_dash"}), st.rerun())}
            ]
        },
        "classroom_late_dash": {
            "title": "🏃 닌자식 순간 대시 시도",
            "desc": "교수님의 시선을 피해 찰나의 틈을 타 빈 좌석으로 대시해야 합니다. 성공하려면 **주사위 4 이상**이 나와야 정숙하게 착석할 수 있습니다. 실패하면 대참사가 일어납니다!",
            "type": "dice",
            "target": 4,
            "success_step": "lunch",
            "fail_step": "lunch",
            "success_action": lambda d: update_adv_stats(rep_change=5, log_msg=f"🎲 주사위 {d}! 대시 성공! 신속하게 미끄러져 들어가 아무도 눈치채지 못하게 착석했습니다."),
            "fail_action": lambda d: update_adv_stats(hp_change=-20, rep_change=-20, log_msg=f"🎲 주사위 {d}! 실패! 뛰어가다 교탁 다리에 발가락을 부딪치며 넘어지는 바람에 웃음거리로 전락했습니다.")
        },

        # ------------------------------------------
        # 4. 식당 씬
        # ------------------------------------------
        "lunch": {
            "title": "🍚 마법학교 대식당 (점심)",
            "desc": "기진맥진한 상태로 식당에 입성했습니다. 한 구석에서 소매가 닳은 로브를 입은 3학년 선배가 음흉한 미소를 지으며 무언가 약병을 흔들고 있습니다. '신입생, 이거 마셔봐. 내 졸업 연구작인데 마력이 순식간에 회복된다고!' 어떻게 할까요?",
            "type": "choices",
            "options": [
                {"text": "🧪 강해지고 싶다! 선배의 비약을 들이킨다 (주사위 4 이상 성공)", "action": lambda: (st.session_state.update({"adv_step": "lunch_potion"}), st.rerun())},
                {"text": "🍚 돈 낭비다. 그냥 일반 학식을 건강히 먹는다 (체력 +30)", "action": lambda: (update_adv_stats(hp_change=30, log_msg="🍚 맛있는 등심 오므라이스 학식을 꼭꼭 씹어 먹고 기력을 완전히 회복했습니다."), st.session_state.update({"adv_step": "afternoon"}), st.rerun())},
                {"text": "⚔️ '수상한 물약을 신입생에게 팔다니! 마법 듀얼이다!' 듀얼을 신청한다", "action": lambda: (update_adv_stats(rep_change=10, log_msg="⚔️ 기백 좋게 선배에게 정식 듀얼을 요구해 식당 구경꾼들의 환호를 받았습니다!"), st.session_state.update({"adv_step": "duel"}), st.rerun())}
            ]
        },
        "lunch_potion": {
            "title": "🧪 의문의 약물 투여",
            "desc": "물약을 다 마셨습니다! <strong>주사위 4 이상</strong>이 나오면 마력이 비약적으로 정제되어 증폭되지만, 3 이하가 나오면 몸이 부작용으로 개구리로 변할 것입니다...",
            "type": "dice",
            "target": 4,
            "success_step": "afternoon",
            "fail_step": "ending_frog",
            "success_action": lambda d: update_adv_stats(mp_change=50, hp_change=10, log_msg=f"🎲 주사위 {d}! 비약 대성공! 마나 정맥이 활성화되어 마력이 50 상승했습니다!"),
            "fail_action": lambda d: update_adv_stats(log_msg=f"🎲 주사위 {d}! 부작용 대폭발! 온몸에 털과 함께 피부가 초록색으로 변해 개구리가 되었습니다!")
        },

        # ------------------------------------------
        # 5. 듀얼 씬
        # ------------------------------------------
        "duel": {
            "title": "⚔️ 야외 연무장 결투",
            "desc": "선배가 번개 소환 주문을 읊기 시작했습니다! 웅웅거리는 전류가 당신을 조여옵니다. 선배를 제압하고 승리하려면 마나 30을 안전하게 소모해 실드를 켜거나, 운에 맡기고 주사위 대결을 벌여야 합니다.",
            "type": "choices",
            "options": [
                {"text": "🛡️ 마법 방어막(실드) 전개 (마력 -30, 안전 성공, 평판 +30)", "action": lambda: (update_adv_stats(mp_change=-30, rep_change=30, log_msg="🛡️ 마나 보호막을 펼쳐 적의 번개를 완전히 반사하고 카운터를 꽂아 결투에서 이겼습니다!"), st.session_state.update({"adv_step": "afternoon"}), st.rerun())},
                {"text": "🎲 맞대응 마법 영창 (주사위 5 이상 필요, 실패시 큰 화를 입음)", "action": lambda: (st.session_state.update({"adv_step": "duel_roll"}), st.rerun())},
                {"text": "🏃 '이건 선배가 반칙이에요!' 소리치고 도망치기 (평판 -30, 체력 -10)", "action": lambda: (update_adv_stats(hp_change=-10, rep_change=-30, log_msg="🏃 결투 직전 겁을 먹고 뒤를 돌아서 도망쳐 한동안 겁쟁이로 놀림받게 되었습니다."), st.session_state.update({"adv_step": "afternoon"}), st.rerun())}
            ]
        },
        "duel_roll": {
            "title": "🎲 운명의 스펠 충돌",
            "desc": "서로의 주문이 부딪힙니다! 이 기세를 뚫고 승리하려면 **주사위 5 이상**이 나와야 합니다. 실패하면 강력한 감전 충격으로 큰 화상을 입습니다.",
            "type": "dice",
            "target": 5,
            "success_step": "afternoon",
            "fail_step": "afternoon",
            "success_action": lambda d: update_adv_stats(rep_change=45, log_msg=f"🎲 주사위 {d}! 대역전 극장! 번개를 가르고 화려하게 불꽃 강타로 선배를 쓰러트리며 결투장에서 위상을 넓혔습니다!"),
            "fail_action": lambda d: update_adv_stats(hp_change=-50, rep_change=-15, log_msg=f"🎲 주사위 {d}! 감전 패배... 직격타로 온몸에 마비가 와 뒹굴며 막대한 피해를 입었습니다.")
        },

        # ------------------------------------------
        # 6. 지하실 던전 씬
        # ------------------------------------------
        "dungeon": {
            "title": "🕸️ 축축한 지하실 던전",
            "desc": "공간 균열로 떨어진 이곳은 먼지 쌓인 지하 감옥 던전입니다. 눈앞에 보라색 산성 맹독을 질질 흘리는 거대 슬라임 보스가 다가옵니다! 어떻게 탈출할까요?",
            "type": "choices",
            "options": [
                {"text": "☄️ 파이어 스펠로 슬라임 증발시키기 (마력 -20, 평판 +20)", "action": lambda: (update_adv_stats(mp_change=-20, rep_change=20, log_msg="☄️ 파이어 마법을 난사하여 보라색 슬라임을 수증기로 말려 없애고 무사히 탈출했습니다."), st.session_state.update({"adv_step": "afternoon"}), st.rerun())},
                {"text": "⚔️ 고드름을 깎아 물리적으로 약점 던지기 (주사위 4 이상 성공)", "action": lambda: (st.session_state.update({"adv_step": "dungeon_throw"}), st.rerun())},
                {"text": "🏃 아무 공격도 안 하고 뒤도 안 돌아보고 도망가기 (체력 -30)", "action": lambda: (update_adv_stats(hp_change=-30, log_msg="🏃 던전 비상구로 필사적으로 달리다가 슬라임이 뿜어댄 맹독 파편에 맞아 엉덩이가 다쳤습니다."), st.session_state.update({"adv_step": "afternoon"}), st.rerun())}
            ]
        },
        "dungeon_throw": {
            "title": "⚔️ 던전 속 절체절명 투척",
            "desc": "돌맹이와 얼음 고드름을 조준해 슬라임 중심부의 마법 코어를 향해 던집니다! <strong>주사위 4 이상</strong>이 나와야 명중하며, 그렇지 않으면 화가 난 슬라임에게 당합니다.",
            "type": "dice",
            "target": 4,
            "success_step": "afternoon",
            "fail_step": "afternoon",
            "success_action": lambda d: update_adv_stats(rep_change=25, log_msg=f"🎲 주사위 {d}! 정확한 샷! 코어가 파괴되어 슬라임이 진흙이 되어 사라지고 포션을 발견하여 무사히 올라왔습니다."),
            "fail_action": lambda d: update_adv_stats(hp_change=-40, log_msg=f"🎲 주사위 {d}! 빗나감! 슬라임이 돌진하여 깔아뭉개지는 충격을 고스란히 받았습니다!")
        },

        # ------------------------------------------
        # 7. 오후 선택 씬
        # ------------------------------------------
        "afternoon": {
            "title": "🌆 마법학교 오후 (오후 3시)",
            "desc": "정신없는 오전 일과가 끝났습니다. 오늘 밤은 9시에 '마법 학업 종합 평가 시험'이 열리는 날입니다. 시험 대비를 위해 무엇을 하며 보낼까요?",
            "type": "choices",
            "options": [
                {"text": "📖 도서관에서 시험 족보 벼락치기 공부하기 (평판 +15, 마력 -10)", "action": lambda: (update_adv_stats(mp_change=-10, rep_change=15, log_msg="📖 도서관에서 어두워질 때까지 실전 시험 족보를 암기했습니다."), st.session_state.update({"adv_step": "evaluation"}), st.rerun())},
                {"text": "🌲 금지된 야생 숲에서 희귀 마법초 캐오기 (체력 -15, 마력 +30)", "action": lambda: (update_adv_stats(hp_change=-15, mp_change=30, log_msg="🌲 숲속 깊이 들어갔다가 신성 마나 풀을 발견해 씹어 먹고 마나를 채웠습니다."), st.session_state.update({"adv_step": "evaluation"}), st.rerun())},
                {"text": "😴 시험이고 뭐고 일단 침대에서 낮잠 자기 (체력 +40, 마력 +20)", "action": lambda: (update_adv_stats(hp_change=40, mp_change=20, log_msg="😴 꿀 같은 낮잠으로 체력과 정신을 최상의 컨디션으로 올렸습니다."), st.session_state.update({"adv_step": "evaluation"}), st.rerun())}
            ]
        },

        # ------------------------------------------
        # 8. 최종 종합 평가
        # ------------------------------------------
        "evaluation": {
            "title": "📝 마법 종합 평가 시험장 (오후 9시)",
            "desc": "시험지가 배부되었습니다! 아그니 교수님이 독기 어린 눈으로 신입생들을 감시하고 있습니다. 마법 지식을 테스트하는 결정적 이론 한 문항이 주어집니다!",
            "type": "quiz",
            "question": "Q. 다음 중 정통 마법을 시전할 때 작용하는 '마법의 3대 요소'로 옳지 않은 것은?",
            "answers": ["마력 (Mana)", "의지 (Will)", "자금 (Gold)"],
            "correct_idx": 2,
            "success_action": lambda: update_adv_stats(rep_change=35, log_msg="📝 정답 제출 완료! 완벽한 답안지에 교수님이 함박웃음을 지으셨습니다. 평판이 오릅니다."),
            "fail_action": lambda: update_adv_stats(rep_change=-25, log_msg="📝 시험 오답 제출... 마법 기초가 전혀 안 되어 있다며 교수님의 탄식이 흐릅니다."),
            "next_step": "determine_ending"
        }
    }

    if step == "determine_ending":
        # 최종 평가 결과에 따라 엔딩 스위칭
        # 1. 체력 0 이하는 이미 update_adv_stats에서 hospital로 분기
        rep = st.session_state.adv_rep
        hp = st.session_state.adv_hp
        
        if rep >= 75 and hp >= 50:
            st.session_state.adv_step = "ending_hero"
        elif rep < 30:
            st.session_state.adv_step = "ending_sleepy"
        else:
            st.session_state.adv_step = "ending_normal"
        st.rerun()

    # 엔딩 씬 데이터 처리
    endings = {
        "ending_hero": {
            "title": "🏆 수석 장학생 영웅 엔딩",
            "desc": "<strong>[수석 신입생 등극]</strong><br>성실함과 뛰어난 용기, 그리고 완벽한 시험 답안으로 교수진 전체의 찬사를 받았습니다! 마학계의 차세대 거물로 인정받아 장학 훈장을 목에 걸었습니다. 최고의 하루였습니다!",
            "color": "green"
        },
        "ending_normal": {
            "title": "🧙 평범한 신입생의 내일 엔딩",
            "desc": "<strong>[무사한 하루]</strong><br>크게 다치지 않고 무난하게 신입생 평가 시험을 통과했습니다. 대단한 사건은 없었지만, 내일도 마법학교의 태양은 뜰 것이고 당신은 조금 더 자라 있을 것입니다. 무던한 성공!",
            "color": "blue"
        },
        "ending_sleepy": {
            "title": "💤 퇴학 조치 및 낙향 엔딩",
            "desc": "<strong>[불성실 퇴학 통보]</strong><br>종일 무단지각을 일삼고 학업에 집중하지 않아 평판이 무참히 박살났습니다. 결국 아그니 교수님이 퇴학 서류에 서명을 하셨습니다... 고향으로 돌아가 평범한 농부가 되어 마법을 그리워할 일만 남았습니다.",
            "color": "orange"
        },
        "ending_frog": {
            "title": "🐸 개구리 조교 펫 엔딩",
            "desc": "<strong>[부작용 극대화]</strong><br>선배의 알 수 없는 비약 부작용으로 인간의 형상을 잃었습니다. 결국 아그니 교수님의 수집장 한 칸에 배치되어 실험 조교용 애완 개구리 신세가 되었습니다. 개굴개굴 노래만 부를 수 있습니다.",
            "color": "purple"
        },
        "ending_hospital": {
            "title": "🏥 양로실 유급 병동 엔딩",
            "desc": "<strong>[체력 고갈 실신]</strong><br>무리한 격투와 모험으로 뼈가 으스러지고 생명력을 잃었습니다. 혼수상태로 실려 가 전치 12주의 판정을 받고 이번 학기 유급이 결정되었습니다. 병동 약을 들이켜며 긴 한숨을 짓습니다.",
            "color": "red"
        }
    }

    # 현재 씬 정보 가져오기
    if step in scenes:
        scene = scenes[step]
        
        st.markdown(
            f"""
            <div style='background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.15); padding: 25px; border-radius: 16px; margin: 20px 0;'>
                <h3 style='color: #38bdf8; margin-top: 0;'>📍 {scene["title"]}</h3>
                <p style='font-size: 16px; line-height: 1.6; color: #f8fafc;'>{scene["desc"]}</p>
            </div>
            """,
            unsafe_allow_html=True
        )

        if scene["type"] == "choices":
            # 선택지 나열
            for idx, opt in enumerate(scene["options"]):
                if st.button(opt["text"], key=f"adv_opt_{idx}", use_container_width=True):
                    opt["action"]()

        elif scene["type"] == "dice":
            # 주사위 이벤트
            st.write(f"🎯 **미션 성공 기준:** 주사위 눈 **{scene['target']} 이상** 필요")
            
            if st.session_state.adv_dice_val is None:
                if st.button("🎲 주사위 던지기", key="adv_roll_btn", use_container_width=True):
                    # 주사위 롤 수행
                    val = random.randint(1, 6)
                    st.session_state.adv_dice_val = val
                    st.rerun()
            else:
                val = st.session_state.adv_dice_val
                st.write(f"### 🎲 주사위 결과: {val}")
                
                if val >= scene["target"]:
                    st.success("🎉 주사위 판정: 성공!")
                    if st.button("확인 후 다음으로", key="adv_dice_next_s", use_container_width=True):
                        scene["success_action"](val)
                        st.session_state.adv_step = scene["success_step"]
                        st.session_state.adv_dice_val = None
                        st.rerun()
                else:
                    st.error("💀 주사위 판정: 실패...")
                    if st.button("확인 후 다음으로", key="adv_dice_next_f", use_container_width=True):
                        scene["fail_action"](val)
                        st.session_state.adv_step = scene["fail_step"]
                        st.session_state.adv_dice_val = None
                        st.rerun()

        elif scene["type"] == "quiz":
            # 퀴즈 이벤트
            st.write(f"### ✏️ {scene['question']}")
            
            # 사용자 답변 양식
            quiz_key = f"quiz_ans_{step}"
            user_ans = st.radio("보기 중 하나를 고르세요", scene["answers"], index=0, key=quiz_key)
            
            if st.button("제출 및 판정", key="quiz_sub_btn", use_container_width=True):
                chosen_idx = scene["answers"].index(user_ans)
                if chosen_idx == scene["correct_idx"]:
                    scene["success_action"]()
                else:
                    scene["fail_action"]()
                
                st.session_state.adv_step = scene["next_step"]
                st.rerun()

    elif step in endings:
        ending = endings[step]
        color_map = {
            "green": "success",
            "blue": "info",
            "orange": "warning",
            "purple": "warning",
            "red": "error"
        }
        status_func = getattr(st, color_map[ending["color"]])
        
        st.markdown(
            f"""
            <div style='background: rgba(255, 255, 255, 0.05); border: 2px solid #ff8787; padding: 25px; border-radius: 16px; margin: 20px 0; text-align: center;'>
                <h2 style='color: #f472b6; margin-top: 0;'>🎬 엔딩: {ending["title"]}</h2>
            </div>
            """,
            unsafe_allow_html=True
        )
        
        status_func(ending["desc"])
        
        if st.button("🔄 처음부터 다시 모험하기", key="restart_adv_btn", use_container_width=True):
            if "adv_step" in st.session_state: del st.session_state.adv_step
            if "adv_hp" in st.session_state: del st.session_state.adv_hp
            if "adv_mp" in st.session_state: del st.session_state.adv_mp
            if "adv_rep" in st.session_state: del st.session_state.adv_rep
            if "adv_log" in st.session_state: del st.session_state.adv_log
            if "adv_dice_val" in st.session_state: del st.session_state.adv_dice_val
            st.rerun()

    # 모험 일지 로그 히스토리 렌더링
    st.divider()
    st.subheader("📜 모험 실시간 로그")
    for log in st.session_state.adv_log[:6]:
        st.write(log)


# ==========================================
# 7. 스피드 타자 게임 (Speed Typing Warrior)
# ==========================================
def typing_game_page():
    import time

    st.title("⌨️ 스피드 타자 워리어 (Speed Typing Warrior)")
    st.write("파이썬 코딩 키워드를 정확하게 빠르게 타이핑하세요! WPM과 정확도를 측정합니다.")

    # ── 단계별 문장 풀 ──────────────────────────────────────────────
    LEVELS = [
        {
            "name": "🟢 Lv.1 입문",
            "prompts": [
                "def hello",
                "print name",
                "import os",
                "x = 10",
                "if True",
                "for i in",
                "return x",
                "x = None",
                "str int",
                "list dict",
            ]
        },
        {
            "name": "🟡 Lv.2 초급",
            "prompts": [
                "def greet(name):",
                "print(hello world)",
                "import random",
                "x = range(10)",
                "if x > 0:",
                "for i in range(5):",
                "return True",
                "while True:",
                "try: except:",
                "class MyClass:",
            ]
        },
        {
            "name": "🟠 Lv.3 중급",
            "prompts": [
                "def __init__(self):",
                "st.session_state",
                "st.text_input('input')",
                "lambda x: x * 2",
                "[x for x in range(10)]",
                "dict.get(key, None)",
                "with open('file') as f:",
                "import streamlit as st",
                "st.button('클릭')",
                "random.randint(1, 100)",
            ]
        },
        {
            "name": "🔴 Lv.4 고급",
            "prompts": [
                "st.session_state['key'] = value",
                "def calculate(a, b, op='+'):",
                "{k: v for k, v in items()}",
                "st.markdown(html, unsafe_allow_html=True)",
                "class Hero(object): pass",
                "try:\n    x = int(input())\nexcept ValueError:",
                "[i**2 for i in range(1, 11)]",
                "if __name__ == '__main__':",
                "st.set_page_config(page_title='App')",
                "sorted(data, key=lambda x: x['score'], reverse=True)",
            ]
        },
        {
            "name": "💀 Lv.5 마스터",
            "prompts": [
                "from functools import reduce, partial",
                "st.columns([1, 2, 1])[1].write('center')",
                "data = {k: [v*2 for v in vals] for k, vals in raw.items()}",
                "assert isinstance(obj, dict), 'must be dict'",
                "@st.cache_data(ttl=3600)\ndef load(): pass",
                "def decorator(func):\n    def wrapper(*args):\n        return func(*args)\n    return wrapper",
                "pd.DataFrame(data).groupby('col').agg({'val': 'sum'})",
                "os.path.join(os.getcwd(), 'data', 'file.json')",
                "[(i, j) for i in range(3) for j in range(3) if i != j]",
                "asyncio.run(main())",
            ]
        }
    ]

    # ── 세션 상태 초기화 ──────────────────────────────────────────
    def init_typing_state():
        if 'ty_level' not in st.session_state:
            st.session_state.ty_level = 0
        if 'ty_prompt_idx' not in st.session_state:
            st.session_state.ty_prompt_idx = 0
        if 'ty_start_time' not in st.session_state:
            st.session_state.ty_start_time = None
        if 'ty_results' not in st.session_state:
            st.session_state.ty_results = []  # (wpm, accuracy, prompt)
        if 'ty_correct_count' not in st.session_state:
            st.session_state.ty_correct_count = 0
        if 'ty_game_phase' not in st.session_state:
            st.session_state.ty_game_phase = 'select_level'  # select_level / playing / round_result / final
        if 'ty_last_wpm' not in st.session_state:
            st.session_state.ty_last_wpm = 0
        if 'ty_last_acc' not in st.session_state:
            st.session_state.ty_last_acc = 0
        if 'ty_last_correct' not in st.session_state:
            st.session_state.ty_last_correct = False
        if 'ty_prompts_order' not in st.session_state:
            st.session_state.ty_prompts_order = list(range(10))

    init_typing_state()

    phase = st.session_state.ty_game_phase

    # ─────────────────────────────────────────────────────────────
    # 레벨 선택 화면
    # ─────────────────────────────────────────────────────────────
    if phase == 'select_level':
        st.markdown("""
        <style>
        .ty-card {
            background: linear-gradient(135deg, rgba(99,102,241,0.2), rgba(168,85,247,0.2));
            border: 1px solid rgba(168,85,247,0.4);
            border-radius: 16px;
            padding: 24px;
            margin: 16px 0;
            text-align: center;
        }
        .ty-badge {
            display: inline-block;
            padding: 4px 14px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
            margin: 4px;
        }
        </style>
        """, unsafe_allow_html=True)

        st.markdown("<div class='ty-card'><h3>⌨️ 타자 게임 방법</h3><p>단어나 코드를 정확히 타이핑하면 <b>WPM(분당 단어 수)</b>과 <b>정확도</b>가 측정됩니다.<br>각 레벨당 <b>5문장</b>을 타이핑하면 최종 점수를 받아요!</p></div>", unsafe_allow_html=True)

        st.write("### 🎯 레벨을 선택해 주세요")
        lvl_cols = st.columns(len(LEVELS))
        for i, lvl in enumerate(LEVELS):
            with lvl_cols[i]:
                if st.button(lvl['name'], key=f"ty_lvl_{i}", use_container_width=True):
                    st.session_state.ty_level = i
                    import random as _random
                    _random.shuffle(st.session_state.ty_prompts_order)
                    st.session_state.ty_prompt_idx = 0
                    st.session_state.ty_results = []
                    st.session_state.ty_correct_count = 0
                    st.session_state.ty_start_time = None
                    st.session_state.ty_game_phase = 'playing'
                    st.rerun()

        # 역대 기록 표시
        if 'ty_highscores' in st.session_state and st.session_state.ty_highscores:
            st.divider()
            st.write("### 🏆 이번 세션 최고 기록")
            for hs in st.session_state.ty_highscores[-3:]:
                st.info(f"📊 레벨: {hs['level']} | 평균 WPM: {hs['avg_wpm']} | 정확도: {hs['avg_acc']}%")

    # ─────────────────────────────────────────────────────────────
    # 게임 플레이 화면
    # ─────────────────────────────────────────────────────────────
    elif phase == 'playing':
        level = LEVELS[st.session_state.ty_level]
        prompts = level['prompts']
        total_rounds = 5
        cur_idx = st.session_state.ty_prompt_idx

        if cur_idx >= total_rounds:
            st.session_state.ty_game_phase = 'final'
            st.rerun()
            return

        prompt_pool_idx = st.session_state.ty_prompts_order[cur_idx]
        current_prompt = prompts[prompt_pool_idx % len(prompts)]

        # 진행도 표시
        st.write(f"**{level['name']}** | 문장 {cur_idx + 1} / {total_rounds}")
        st.progress((cur_idx) / total_rounds)

        # 현재 문장 표시 카드
        st.markdown(
            f"""
            <div style='background: #1e1b4b; border: 2px solid #6366f1; border-radius: 12px;
                        padding: 24px; margin: 12px 0; text-align: center;'>
                <p style='font-size: 12px; color: #c4b5fd; margin-bottom: 12px; font-weight: bold;'>📋 아래 코드를 정확히 타이핑하세요</p>
                <code style='font-size: 24px; color: #ffffff; font-family: monospace; white-space: pre; background: rgba(255,255,255,0.1); padding: 12px 20px; border-radius: 8px; display: inline-block;'>{current_prompt}</code>
            </div>
            """,
            unsafe_allow_html=True
        )

        # 입력 폼 (text_input → 엔터로 제출 가능)
        if st.session_state.ty_start_time is None:
            st.info("💡 타이핑을 시작하면 타이머가 시작됩니다! 다 입력하면 **엔터**를 누르세요 ↵")

        with st.form(key=f"ty_form_{cur_idx}", clear_on_submit=True):
            user_input = st.text_input(
                "여기에 타이핑하세요 ↓ (엔터로 제출)",
                placeholder="타이핑 후 Enter 키를 누르세요...",
                key=f"ty_input_{cur_idx}"
            )
            submitted = st.form_submit_button("✅ 제출 (또는 Enter)", use_container_width=True)

        if submitted and user_input:
            end_time = time.time()

            if st.session_state.ty_start_time is None:
                elapsed = 5.0  # 최초 클릭 시 최소 5초
            else:
                elapsed = max(0.5, end_time - st.session_state.ty_start_time)

            # 타이머 최초 입력 시작
            if st.session_state.ty_start_time is None:
                st.session_state.ty_start_time = time.time() - elapsed

            # WPM 계산 (단어 수 기준)
            word_count = len(current_prompt.split())
            wpm = round((word_count / elapsed) * 60)

            # 정확도 계산 (문자 단위)
            correct_chars = sum(
                1 for a, b in zip(user_input.strip(), current_prompt)
                if a == b
            )
            max_len = max(len(current_prompt), len(user_input.strip()))
            accuracy = round((correct_chars / max_len) * 100) if max_len > 0 else 0

            is_correct = user_input.strip() == current_prompt

            # 결과 저장
            st.session_state.ty_results.append({
                'wpm': wpm,
                'accuracy': accuracy,
                'correct': is_correct,
                'prompt': current_prompt
            })
            if is_correct:
                st.session_state.ty_correct_count += 1

            st.session_state.ty_last_wpm = wpm
            st.session_state.ty_last_acc = accuracy
            st.session_state.ty_last_correct = is_correct
            st.session_state.ty_prompt_idx += 1
            st.session_state.ty_start_time = None  # 타이머 리셋
            st.session_state.ty_game_phase = 'round_result'
            st.rerun()

        # 타이머 시작 힌트
        if st.session_state.ty_start_time is None and not submitted:
            if st.button("▶️ 타이머 시작", key="ty_timer_start"):
                st.session_state.ty_start_time = time.time()
                st.rerun()
        elif st.session_state.ty_start_time is not None:
            elapsed_now = time.time() - st.session_state.ty_start_time
            st.caption(f"⏱️ 경과 시간: {elapsed_now:.1f}초")

    # ─────────────────────────────────────────────────────────────
    # 라운드 결과 화면
    # ─────────────────────────────────────────────────────────────
    elif phase == 'round_result':
        wpm = st.session_state.ty_last_wpm
        acc = st.session_state.ty_last_acc
        correct = st.session_state.ty_last_correct
        done = st.session_state.ty_prompt_idx
        total = 5

        if correct:
            st.markdown("""
            <div style='text-align:center; font-size: 60px; animation: pulse 0.5s;'>🎉✨🔥</div>
            """, unsafe_allow_html=True)
            st.success(f"✅ 정확히 입력했습니다! WPM: **{wpm}** | 정확도: **{acc}%**")
        else:
            st.markdown("""
            <div style='text-align:center; font-size: 60px;'>⚠️</div>
            """, unsafe_allow_html=True)
            st.warning(f"⚡ 아쉽지만 오타가 있어요. WPM: **{wpm}** | 정확도: **{acc}%**")

        # WPM 속도 평가
        if wpm >= 120:
            st.info("🚀 타자 속도: **번개 급** (WPM 120+) - 전설의 코더!")
        elif wpm >= 80:
            st.info("💨 타자 속도: **고속** (WPM 80+) - 훌륭합니다!")
        elif wpm >= 50:
            st.info("👍 타자 속도: **표준** (WPM 50+) - 좋아요!")
        elif wpm >= 30:
            st.info("🐢 타자 속도: **느림** (WPM 30+) - 더 빠르게!")
        else:
            st.info("🐌 타자 속도: **초급** (WPM 30 미만) - 연습이 필요해요!")

        st.write(f"진행도: **{done} / {total}** 완료")
        st.progress(done / total)

        btn_label = "▶️ 다음 문장" if done < total else "🏁 결과 보기"
        if st.button(btn_label, key="ty_next_btn", use_container_width=True):
            if done >= total:
                st.session_state.ty_game_phase = 'final'
            else:
                st.session_state.ty_game_phase = 'playing'
            st.rerun()

    # ─────────────────────────────────────────────────────────────
    # 최종 결과 화면
    # ─────────────────────────────────────────────────────────────
    elif phase == 'final':
        results = st.session_state.ty_results
        level = LEVELS[st.session_state.ty_level]

        if not results:
            st.warning("결과 데이터가 없습니다.")
        else:
            avg_wpm = round(sum(r['wpm'] for r in results) / len(results))
            avg_acc = round(sum(r['accuracy'] for r in results) / len(results))
            correct_cnt = sum(1 for r in results if r['correct'])

            # 등급 계산
            if avg_wpm >= 100 and avg_acc >= 90:
                grade = ("🏆 SSS 랭크", "#f59e0b", "전설의 코딩 마스터!")
            elif avg_wpm >= 80 and avg_acc >= 85:
                grade = ("🥇 S 랭크", "#eab308", "탁월한 타자 실력!")
            elif avg_wpm >= 60 and avg_acc >= 80:
                grade = ("🥈 A 랭크", "#9ca3af", "우수한 속도와 정확도!")
            elif avg_wpm >= 40 and avg_acc >= 70:
                grade = ("🥉 B 랭크", "#b45309", "더 연습하면 A랭크도 금방!")
            else:
                grade = ("📚 C 랭크", "#6b7280", "꾸준히 연습해요!")

            st.markdown(
                f"""
                <div style='background: linear-gradient(135deg, rgba(99,102,241,0.3), rgba(168,85,247,0.3));
                            border: 2px solid #6366f1; border-radius: 20px; padding: 30px; text-align: center; margin: 20px 0;'>
                    <h2 style='color: #c4b5fd; margin: 0 0 8px 0;'>🎮 게임 종료!</h2>
                    <h1 style='color: {grade[1]}; margin: 0; font-size: 48px;'>{grade[0]}</h1>
                    <p style='color: #e2e8f0; font-size: 18px; margin: 8px 0 0 0;'>{grade[2]}</p>
                </div>
                """,
                unsafe_allow_html=True
            )

            # 상세 통계
            mc1, mc2, mc3, mc4 = st.columns(4)
            mc1.metric("⚡ 평균 WPM", avg_wpm)
            mc2.metric("🎯 평균 정확도", f"{avg_acc}%")
            mc3.metric("✅ 정답 문장", f"{correct_cnt} / {len(results)}")
            mc4.metric("📊 레벨", level['name'].split(' ')[1])

            st.divider()
            st.write("### 📋 문장별 상세 결과")
            for i, r in enumerate(results):
                icon = "✅" if r['correct'] else "❌"
                st.write(f"{icon} **문장 {i+1}**: `{r['prompt'][:40]}{'...' if len(r['prompt']) > 40 else ''}` | WPM: {r['wpm']} | 정확도: {r['accuracy']}%")

            # 고득점 기록 저장
            if 'ty_highscores' not in st.session_state:
                st.session_state.ty_highscores = []
            st.session_state.ty_highscores.append({
                'level': level['name'],
                'avg_wpm': avg_wpm,
                'avg_acc': avg_acc,
                'grade': grade[0]
            })

        col_a, col_b = st.columns(2)
        if col_a.button("🔄 같은 레벨 다시 도전", use_container_width=True):
            st.session_state.ty_prompt_idx = 0
            st.session_state.ty_results = []
            st.session_state.ty_correct_count = 0
            st.session_state.ty_start_time = None
            import random as _r
            _r.shuffle(st.session_state.ty_prompts_order)
            st.session_state.ty_game_phase = 'playing'
            st.rerun()
        if col_b.button("🏠 레벨 선택으로 돌아가기", use_container_width=True):
            for key in list(st.session_state.keys()):
                if key.startswith('ty_') and key != 'ty_highscores':
                    del st.session_state[key]
            st.session_state.ty_game_phase = 'select_level'
            st.rerun()


# ==========================================
# 7. 1대1 실시간 멀티 RPG 결투장 기능
# ==========================================
class MultiplayerManager:
    def __init__(self):
        self.rooms = {}  # room_id -> room_state dict

    def create_room(self, p1_name, hp, atk, def_val):
        room_id = str(random.randint(1000, 9999))
        while room_id in self.rooms:
            room_id = str(random.randint(1000, 9999))
            
        self.rooms[room_id] = {
            "p1_name": p1_name,
            "p1_hp": hp,
            "p1_max_hp": hp,
            "p1_atk": atk,
            "p1_def": def_val,
            "p1_last_action": None,
            "p1_defending": False,
            
            "p2_name": None,
            "p2_hp": None,
            "p2_max_hp": None,
            "p2_atk": None,
            "p2_def": None,
            "p2_last_action": None,
            "p2_defending": False,
            
            "turn": 1,
            "status": "waiting",
            "winner": None,
            "p1_cooldown": 0,
            "p2_cooldown": 0,
            "p1_heal_used": False,
            "p2_heal_used": False,
            "logs": ["방이 생성되었습니다. 대기 중..."],
            "version": 0
        }
        return room_id

    def join_room(self, room_id, p2_name, hp, atk, def_val):
        if room_id in self.rooms:
            room = self.rooms[room_id]
            if room["p2_name"] is None and room["status"] == "waiting":
                room["p2_name"] = p2_name
                room["p2_hp"] = hp
                room["p2_max_hp"] = hp
                room["p2_atk"] = atk
                room["p2_def"] = def_val
                room["status"] = "fighting"
                room["logs"].insert(0, f"⚔️ {p2_name}님이 입장했습니다! 결투가 시작됩니다!")
                room["version"] += 1
                return True
        return False

    def execute_action(self, room_id, player_idx, action):
        if room_id not in self.rooms:
            return False
        room = self.rooms[room_id]
        if room["status"] != "fighting":
            return False
        if room["turn"] != player_idx:
            return False
            
        p_prefix = f"p{player_idx}"
        o_prefix = "p2" if player_idx == 1 else "p1"
        
        if player_idx == 1:
            if room["p1_cooldown"] > 0:
                room["p1_cooldown"] -= 1
        else:
            if room["p2_cooldown"] > 0:
                room["p2_cooldown"] -= 1

        room[f"{p_prefix}_defending"] = False
        
        logs = []
        p_name = room[f"{p_prefix}_name"]
        o_name = room[f"{o_prefix}_name"]
        
        if action == "attack":
            dmg = max(1, room[f"{p_prefix}_atk"] - room[f"{o_prefix}_def"])
            if room[f"{o_prefix}_defending"]:
                dmg = max(1, dmg // 2)
                logs.append(f"🛡️ {o_name}님이 방어막을 켜 대미지가 절반으로 감소했습니다.")
                room[f"{o_prefix}_defending"] = False
            room[f"{o_prefix}_hp"] = max(0, room[f"{o_prefix}_hp"] - dmg)
            logs.append(f"🗡️ {p_name}님의 일반 공격! {o_name}님에게 {dmg}의 대미지를 입혔습니다.")
            
        elif action == "special":
            dmg = max(1, room[f"{p_prefix}_atk"] * 2 - int(room[f"{o_prefix}_def"] * 0.5))
            if room[f"{o_prefix}_defending"]:
                dmg = max(1, dmg // 2)
                logs.append(f"🛡️ {o_name}님이 방어막을 켜 대미지가 절반으로 감소했습니다.")
                room[f"{o_prefix}_defending"] = False
            room[f"{o_prefix}_hp"] = max(0, room[f"{o_prefix}_hp"] - dmg)
            room[f"{p_prefix}_cooldown"] = 3
            logs.append(f"💥 {p_name}님의 초강력 필살기 시전! {o_name}님에게 {dmg}의 치명적인 대미지를 입혔습니다!")
            
        elif action == "heal":
            heal_amt = int(room[f"{p_prefix}_max_hp"] * 0.5)
            room[f"{p_prefix}_hp"] = min(room[f"{p_prefix}_max_hp"], room[f"{p_prefix}_hp"] + heal_amt)
            room[f"{p_prefix}_heal_used"] = True
            logs.append(f"🧪 {p_name}님이 엘릭서 포션을 들이켰습니다! 체력을 +{heal_amt}만큼 회복했습니다.")
            
        elif action == "defend":
            room[f"{p_prefix}_defending"] = True
            logs.append(f"🛡️ {p_name}님이 방어 태세를 취했습니다. 다음 상대 턴의 대미지를 50% 경감합니다.")
            
        room[f"{p_prefix}_last_action"] = action
        
        if room[f"{o_prefix}_hp"] <= 0:
            room["status"] = "finished"
            room["winner"] = p_name
            logs.append(f"🎉 {o_name}님이 쓰러졌습니다! {p_name}님이 승리했습니다!")
        else:
            room["turn"] = 2 if player_idx == 1 else 1
            
        for log in reversed(logs):
            room["logs"].insert(0, log)
            
        room["version"] += 1
        return True

@st.cache_resource
def get_multiplayer_manager():
    return MultiplayerManager()

def multiplayer_rpg_page():
    st.title("⚔️ 1대1 실시간 멀티 RPG 결투장")
    st.write("친구와 같은 방 ID를 공유해 다른 컴퓨터에서 실시간 1대1 대결을 겨루어 보세요!")

    if "r_lvl" not in st.session_state:
        load_rpg()
    
    if "r_lvl" not in st.session_state:
        st.session_state.r_lvl = 1
        st.session_state.r_max_hp = 60
        st.session_state.r_hp = 60
        st.session_state.r_b_atk = 10
        st.session_state.r_b_def = 2
        st.session_state.r_w_atk = 0
        st.session_state.r_w_enhance = 0
        st.session_state.r_a_def = 0
        st.session_state.r_a_enhance = 0
        st.session_state.r_w_name = "낡은 나뭇가지"
        st.session_state.r_a_name = "천 옷"

    enhance_atk_bonus = st.session_state.r_w_enhance * 8
    enhance_def_bonus = st.session_state.r_a_enhance * 5
    my_atk = st.session_state.r_b_atk + st.session_state.r_w_atk + enhance_atk_bonus
    my_def = st.session_state.r_b_def + st.session_state.r_a_def + enhance_def_bonus
    my_max_hp = st.session_state.r_max_hp
    
    st.subheader("👤 나의 결투 참가자 프로필")
    mc1, mc2, mc3, mc4 = st.columns(4)
    mc1.metric("레벨", f"Lv.{st.session_state.r_lvl}")
    mc2.metric("최대 HP", f"{my_max_hp}")
    mc3.metric("공격력", f"⚔️ {my_atk}")
    mc4.metric("방어력", f"🛡️ {my_def}")
    st.caption(f"장착 장비: 무기 - {st.session_state.r_w_name}(+{st.session_state.r_w_enhance}강) | 방어구 - {st.session_state.r_a_name}(+{st.session_state.r_a_enhance}강)")

    st.divider()

    manager = get_multiplayer_manager()

    if "mr_room_id" not in st.session_state:
        st.session_state.mr_room_id = None
        st.session_state.mr_player_idx = None
        st.session_state.mr_my_name = "용사"

    if st.session_state.mr_room_id is None:
        st.subheader("🚪 결투 매칭")
        st.session_state.mr_my_name = st.text_input("닉네임을 입력하세요", value=st.session_state.mr_my_name, max_chars=12)
        
        col_create, col_join = st.columns(2)
        
        with col_create:
            st.write("#### 🆕 방 새로 만들기")
            if st.button("방 생성하고 대기하기", use_container_width=True):
                if not st.session_state.mr_my_name.strip():
                    st.error("닉네임을 입력해 주세요!")
                else:
                    room_id = manager.create_room(st.session_state.mr_my_name, my_max_hp, my_atk, my_def)
                    st.session_state.mr_room_id = room_id
                    st.session_state.mr_player_idx = 1
                    st.rerun()
                    
        with col_join:
            st.write("#### 🔑 다른 방 참가하기")
            join_room_id = st.text_input("방 번호 4자리 입력", placeholder="예: 1234")
            if st.button("방 입장하기", use_container_width=True):
                if not st.session_state.mr_my_name.strip():
                    st.error("닉네임을 입력해 주세요!")
                elif not join_room_id.strip():
                    st.error("방 번호를 정확히 입력해 주세요!")
                else:
                    success = manager.join_room(join_room_id, st.session_state.mr_my_name, my_max_hp, my_atk, my_def)
                    if success:
                        st.session_state.mr_room_id = join_room_id
                        st.session_state.mr_player_idx = 2
                        st.rerun()
                    else:
                        st.error("해당 방이 존재하지 않거나 이미 꽉 찼습니다!")
    else:
        room_id = st.session_state.mr_room_id
        if room_id not in manager.rooms:
            st.error("방이 존재하지 않거나 세션이 만료되었습니다.")
            if st.button("로비로 돌아가기"):
                st.session_state.mr_room_id = None
                st.session_state.mr_player_idx = None
                st.rerun()
            return
            
        room = manager.rooms[room_id]
        my_idx = st.session_state.mr_player_idx
        opp_idx = 2 if my_idx == 1 else 1
        
        st.success(f"🚪 매칭 방 번호: **{room_id}** (친구에게 이 번호를 공유하세요!)")
        
        if room["status"] == "waiting":
            st.warning("⚔️ 상대 플레이어가 접속하기를 기다리고 있습니다...")
            st.info("상대방이 입장하면 결투가 자동으로 시작됩니다.")
            
            if st.button("❌ 매칭 취소 및 나가기", use_container_width=True):
                if room_id in manager.rooms:
                    del manager.rooms[room_id]
                st.session_state.mr_room_id = None
                st.session_state.mr_player_idx = None
                st.rerun()
                
            @st.fragment
            def waiting_poller():
                st.write("🔄 접속 동기화 중...")
                time.sleep(2)
                cur_room = manager.rooms.get(room_id)
                if cur_room and cur_room["status"] == "fighting":
                    st.rerun()
                else:
                    st.rerun()
            
            waiting_poller()
                
        else:
            p1_active = "👉" if room["turn"] == 1 and room["status"] == "fighting" else ""
            p2_active = "👉" if room["turn"] == 2 and room["status"] == "fighting" else ""
            
            col_p1, col_vs, col_p2 = st.columns([4, 2, 4])
            
            with col_p1:
                st.markdown(f"### {p1_active} {room['p1_name']} (P1)")
                hp1 = room["p1_hp"]
                max_hp1 = room["p1_max_hp"]
                st.write(f"❤️ HP: **{hp1}** / {max_hp1}")
                st.progress(max(0.0, min(1.0, hp1 / max_hp1)))
                if room["p1_defending"]:
                    st.info("🛡️ 방어막 작동 중")
                st.caption(f"⚔️ ATK: {room['p1_atk']} | 🛡️ DEF: {room['p1_def']}")
                if room["p1_heal_used"]:
                    st.caption("🧪 포션 사용 완료")
                    
            with col_vs:
                st.markdown("<h2 style='text-align: center; margin-top: 15px;'>VS</h2>", unsafe_allow_html=True)
                
            with col_p2:
                st.markdown(f"### {p2_active} {room['p2_name']} (P2)")
                hp2 = room["p2_hp"]
                max_hp2 = room["p2_max_hp"]
                st.write(f"❤️ HP: **{hp2}** / {max_hp2}")
                st.progress(max(0.0, min(1.0, hp2 / max_hp2)))
                if room["p2_defending"]:
                    st.info("🛡️ 방어막 작동 중")
                st.caption(f"⚔️ ATK: {room['p2_atk']} | 🛡️ DEF: {room['p2_def']}")
                if room["p2_heal_used"]:
                    st.caption("🧪 포션 사용 완료")
            
            st.divider()
            
            if room["status"] == "finished":
                st.balloons()
                st.success(f"🎉 **결투 종료!** 승리자: **{room['winner']}**")
                if st.button("🚪 로비로 나가기", use_container_width=True):
                    if room_id in manager.rooms:
                        del manager.rooms[room_id]
                    st.session_state.mr_room_id = None
                    st.session_state.mr_player_idx = None
                    st.rerun()
                return

            my_turn = (room["turn"] == my_idx)
            
            if my_turn:
                st.info("🟢 **당신의 차례입니다!** 행동을 선택하세요.")
                
                cd_val = room[f"p{my_idx}_cooldown"]
                spec_label = "💥 필살기 (3턴 쿨)" if cd_val == 0 else f"💥 필살기 ({cd_val}턴 대기)"
                spec_disabled = cd_val > 0
                
                potion_used = room[f"p{my_idx}_heal_used"]
                potion_disabled = potion_used
                
                act_cols = st.columns(4)
                
                if act_cols[0].button("🗡️ 일반 공격", use_container_width=True):
                    manager.execute_action(room_id, my_idx, "attack")
                    st.rerun()
                    
                if act_cols[1].button(spec_label, disabled=spec_disabled, use_container_width=True):
                    manager.execute_action(room_id, my_idx, "special")
                    st.rerun()
                    
                if act_cols[2].button("🛡️ 방어 태세", use_container_width=True):
                    manager.execute_action(room_id, my_idx, "defend")
                    st.rerun()
                    
                if act_cols[3].button("🧪 엘릭서 포션 회복", disabled=potion_disabled, use_container_width=True):
                    manager.execute_action(room_id, my_idx, "heal")
                    st.rerun()
            else:
                st.warning(f"🔴 **상대방({room[f'p{opp_idx}_name']})의 턴입니다.** 대기 중...")
                
                @st.fragment
                def game_poller():
                    st.write("🔄 상대방의 결정을 기다리는 중...")
                    init_version = room["version"]
                    time.sleep(2)
                    cur_room = manager.rooms.get(room_id)
                    if cur_room and cur_room["version"] != init_version:
                        st.rerun()
                    else:
                        st.rerun()
                
                game_poller()
                
            st.divider()
            st.write("### 📜 전투 상황 로그")
            for log in room["logs"][:10]:
                st.write(log)
            
            if st.button("🏳️ 항복하고 방 나가기", use_container_width=True):
                room["status"] = "finished"
                room["winner"] = room[f"p{opp_idx}_name"]
                room["logs"].insert(0, f"🏳️ {room[f'p{my_idx}_name']}님이 항복을 선언했습니다.")
                room["version"] += 1
                st.session_state.mr_room_id = None
                st.session_state.mr_player_idx = None
                st.rerun()


# ==========================================
# 7-2. 드래곤 보육원 & 배틀 RPG (React 임베드)
# ==========================================
DRAGON_GAME_HTML = r'''<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<script src="https://cdn.tailwindcss.com"></script>
<script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
<script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
<script>
  // preset-react 기본값(automatic 런타임)은 UMD 환경에서 import 구문을 생성해
  // "Cannot use import statement outside a module" 오류로 화면이 검게 나온다.
  // classic 런타임(React.createElement)으로 강제하는 커스텀 프리셋을 등록한다.
  Babel.registerPreset('classic-react', {
    presets: [[Babel.availablePresets['react'], { runtime: 'classic' }]]
  });
</script>
<script type="module">
  // Trystero: 계정/서버 없이 브라우저끼리 직접 연결(P2P)하는 라이브러리.
  // 온라인 대전(다른 기기) 기능에서 방 코드로 두 브라우저를 연결하는 데 사용한다.
  import { joinRoom } from 'https://esm.run/@trystero-p2p/torrent';
  window.__trystero = { joinRoom };
  window.dispatchEvent(new Event('trystero-ready'));
</script>
<style>
  html,body{margin:0;padding:0;background:#0b1020;overflow-x:hidden;}
  #root{min-height:100vh;}
  .bar{height:8px;border-radius:9999px;overflow:hidden;background:#1f2937;}
  .bar > div{height:100%;transition:width .3s ease;}
  /* ===== 공격 이펙트 레이어 & 파티클 ===== */
  .fx-layer{position:absolute;inset:0;pointer-events:none;overflow:visible;z-index:40;}
  .fx-node{position:absolute;pointer-events:none;will-change:transform,opacity;z-index:40;
           transform:translate(-50%,-50%);display:flex;align-items:center;justify-content:center;}
  /* 중심 정렬(translate -50%,-50%) 기반 키프레임 */
  @keyframes fxProj{0%{transform:translate(-50%,-50%) scale(var(--s0,.7))}100%{transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy))) scale(var(--s1,1));opacity:1}}
  @keyframes fxTrail{0%{transform:translate(-50%,-50%) scale(1);opacity:.85}100%{transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy))) scale(.3);opacity:0}}
  @keyframes fxBreath{0%{transform:translate(-50%,-50%) scale(.2);opacity:0}30%{opacity:1}100%{transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy))) scale(1.5);opacity:0}}
  @keyframes fxBurst{0%{transform:translate(-50%,-50%) scale(.3);opacity:1}100%{transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy))) scale(.6);opacity:0}}
  @keyframes fxSuck{0%{transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy))) scale(1.1);opacity:0}25%{opacity:1}100%{transform:translate(-50%,-50%) scale(.1);opacity:0}}
  @keyframes fxSpiral{0%{transform:translate(-50%,-50%) rotate(0) scale(.5)}100%{transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy))) rotate(900deg) scale(1.1);opacity:.6}}
  @keyframes fxMeteor{0%{transform:translate(-50%,-50%) rotate(45deg) scale(.7);opacity:1}100%{transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy))) rotate(45deg) scale(1.15);opacity:1}}
  @keyframes fxRipple{0%{transform:translate(-50%,-50%) scale(.2);opacity:.9}100%{transform:translate(-50%,-50%) scale(2.6);opacity:0}}
  @keyframes fxRipple2{0%{transform:translate(-50%,-50%) scale(.4);opacity:.8}100%{transform:translate(-50%,-50%) scale(1.7);opacity:0}}
  @keyframes fxFlash{0%{transform:translate(-50%,-50%) scale(.2);opacity:.95}100%{transform:translate(-50%,-50%) scale(2.2);opacity:0}}
  @keyframes fxImplode{0%{transform:translate(-50%,-50%) scale(.2);opacity:0}40%{transform:translate(-50%,-50%) scale(1.8);opacity:1}100%{transform:translate(-50%,-50%) scale(0);opacity:.9}}
  @keyframes fxRune{0%{transform:translate(-50%,-50%) rotate(0) scale(0);opacity:0}30%{opacity:1;transform:translate(-50%,-50%) rotate(140deg) scale(1)}100%{transform:translate(-50%,-50%) rotate(380deg) scale(1.35);opacity:0}}
  @keyframes fxPop{0%{transform:translate(-50%,-50%) scale(0);opacity:1}60%{transform:translate(-50%,-50%) scale(1.35)}100%{transform:translate(-50%,-50%) scale(1);opacity:0}}
  @keyframes fxSlash{0%{transform:translate(-50%,-50%) rotate(var(--ang)) scaleX(0);opacity:0}30%{opacity:1;transform:translate(-50%,-50%) rotate(var(--ang)) scaleX(1)}100%{opacity:0;transform:translate(-50%,-50%) rotate(var(--ang)) scaleX(1.15)}}
  @keyframes fxSpin{0%{transform:translate(-50%,-50%) rotate(0) scale(.3);opacity:0}30%{opacity:1}100%{transform:translate(-50%,-50%) rotate(360deg) scale(1.4);opacity:0}}
  /* 좌측 기준(빔) */
  @keyframes fxBeam{0%{transform:rotate(var(--ang)) scaleX(0);opacity:0}20%{opacity:1}80%{opacity:1}100%{transform:rotate(var(--ang)) scaleX(1);opacity:0}}
  /* 상단 기준(빛기둥) */
  @keyframes fxPillar{0%{transform:translateX(-50%) scaleY(0);opacity:0}30%{transform:translateX(-50%) scaleY(1);opacity:1}80%{opacity:1}100%{transform:translateX(-50%) scaleY(1);opacity:0}}
  /* 곡선 투사체: --mx/--my 중간점 경유 */
  @keyframes fxCurve{0%{transform:translate(-50%,-50%) scale(var(--s0,.7));opacity:1}50%{transform:translate(calc(-50% + var(--mx)),calc(-50% + var(--my))) scale(1.05)}100%{transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy))) scale(var(--s1,1));opacity:1}}
  /* 바닥 고정 성장(넝쿨/물기둥): origin bottom */
  @keyframes fxVine{0%{transform:translate(-50%,-100%) scaleY(0);opacity:0}25%{opacity:1}70%{transform:translate(-50%,-100%) scaleY(1.06)}85%{transform:translate(-50%,-100%) scaleY(.98);opacity:1}100%{transform:translate(-50%,-100%) scaleY(1);opacity:0}}
  /* 중력 낙하(파편) */
  @keyframes fxGravity{0%{transform:translate(-50%,-50%);opacity:1}60%{opacity:1}100%{transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy)));opacity:0}}
  /* 위로 떠오르며 소멸(불티/치유) */
  @keyframes fxFloat{0%{transform:translate(-50%,-50%) scale(1);opacity:0}20%{opacity:1}100%{transform:translate(calc(-50% + var(--dx)),calc(-50% - var(--dy))) scale(.5);opacity:0}}
  /* 제자리 깜빡임(경고 링/잔불) */
  @keyframes fxBlink{0%,100%{opacity:0}20%,80%{opacity:.9}50%{opacity:.4}}
  /* 그림자 확대(운석 예고) */
  @keyframes fxShadow{0%{transform:translate(-50%,-50%) scale(.15);opacity:0}30%{opacity:.55}100%{transform:translate(-50%,-50%) scale(1);opacity:.75}}
  /* 강력 진동 */
  .quake{animation:quake .5s;}
  @keyframes quake{0%,100%{transform:translate(0,0)}15%{transform:translate(-7px,3px) rotate(-1deg)}35%{transform:translate(6px,-4px) rotate(1deg)}55%{transform:translate(-5px,-3px)}75%{transform:translate(4px,3px) rotate(.5deg)}}
  .glow{animation:glow 1.6s ease-in-out infinite alternate;}
  @keyframes glow{from{filter:drop-shadow(0 0 2px rgba(255,255,255,.2));}to{filter:drop-shadow(0 0 10px rgba(255,255,255,.55));}}
  .shake{animation:shake .4s;}
  @keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
  .fade{animation:fade .3s ease;}
  @keyframes fade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
  .chip{transition:transform .12s;}
  .chip:hover{transform:translateY(-2px);}
  ::-webkit-scrollbar{width:10px;height:10px}::-webkit-scrollbar-thumb{background:#334155;border-radius:8px}
</style>
</head>
<body>
<div id="root"></div>
<script type="text/babel" data-presets="classic-react">
const { useState, useEffect, useRef } = React;

/* ============ 코어 데이터 ============ */
const ELEMENTS = {
  fire:   { name:"불",   emoji:"🔥", color:"#ef4444" },
  water:  { name:"물",   emoji:"💧", color:"#3b82f6" },
  forest: { name:"숲",   emoji:"🌿", color:"#22c55e" },
  metal:  { name:"금속", emoji:"⚙️", color:"#9ca3af" },
  wind:   { name:"바람", emoji:"🌪️", color:"#38bdf8" },
  void:   { name:"공허", emoji:"🌌", color:"#a855f7" },
  holy:   { name:"신성", emoji:"✨", color:"#eab308" },
  ancient:{ name:"고대", emoji:"🏛️", color:"#b45309" },
  earth:  { name:"대지", emoji:"🪨", color:"#92400e" },
};
const ELEM_KEYS = Object.keys(ELEMENTS);
const ADV = {
  fire:["forest","metal"], water:["fire","earth"], forest:["water","wind"],
  metal:["forest","void"], wind:["metal","earth"], void:["holy","ancient"],
  holy:["void","earth"], ancient:["metal","wind"], earth:["fire","forest"],
};
const GRADES = {
  common:    { name:"일반", count:1, color:"#9ca3af", hp:110, atk:16 },
  rare:      { name:"희귀", count:2, color:"#3b82f6", hp:180, atk:27 },
  epic:      { name:"에픽", count:3, color:"#a855f7", hp:270, atk:42 },
  legendary: { name:"전설", count:4, color:"#eab308", hp:390, atk:62 },
};
const gradeByCount = c => c>=4?"legendary":c===3?"epic":c===2?"rare":"common";
const DRAGON_EMOJI = { common:"🦎", rare:"🐊", epic:"🐉", legendary:"🐲" };

/* ============ 유틸 ============ */
let _id = 1; const uid = () => _id++;
const rand = (a,b) => Math.floor(Math.random()*(b-a+1))+a;
const pick = arr => arr[Math.floor(Math.random()*arr.length)];
const sample = (arr,n) => { const c=[...arr], o=[]; while(o.length<n && c.length){ o.push(c.splice(Math.floor(Math.random()*c.length),1)[0]); } return o; };
const uniq = arr => Array.from(new Set(arr));

/* ============ 저장 (localStorage + 이동용 코드) ============ */
const SAVE_KEY = "yunny_dragon_save_v1";
function loadSave(){
  try{
    const raw = localStorage.getItem(SAVE_KEY);
    if(!raw) return null;
    const obj = JSON.parse(raw);
    if(obj && Array.isArray(obj.dragons)) return obj;
  }catch(e){}
  return null;
}
function saveLocal(payload){
  try{ localStorage.setItem(SAVE_KEY, JSON.stringify(payload)); }catch(e){}
}
function encodeSave(obj){
  const json = JSON.stringify(obj);
  const bytes = new TextEncoder().encode(json);
  let bin = "";
  bytes.forEach(b=>{ bin += String.fromCharCode(b); });
  return btoa(bin);
}
function decodeSave(code){
  const bin = atob(code.trim());
  const bytes = new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) bytes[i] = bin.charCodeAt(i);
  const json = new TextDecoder().decode(bytes);
  const obj = JSON.parse(json);
  if(!obj || !Array.isArray(obj.dragons)) throw new Error("invalid save");
  return obj;
}
function ensureTrystero(cb){
  if(window.__trystero){ cb(window.__trystero); return; }
  const handler = ()=>{ window.removeEventListener("trystero-ready", handler); cb(window.__trystero); };
  window.addEventListener("trystero-ready", handler);
}

/* ============ 종족(이름=속성) 시스템 ============
   드래곤의 이름은 속성 조합으로 결정되며 절대 바뀌지 않는다.
   같은 속성 조합 = 같은 이름 = 같은 종족. (도감의 기준) */
const ELEM_LORE = {
  fire:   { base:"이그니스",   syl:"이그" },
  water:  { base:"아쿠아리스", syl:"아쿠" },
  forest: { base:"베르단트",   syl:"베르" },
  metal:  { base:"크롬하르트", syl:"크롬" },
  wind:   { base:"제피로스",   syl:"제피" },
  void:   { base:"녹티스",     syl:"녹티" },
  holy:   { base:"세라피엘",   syl:"세라" },
  ancient:{ base:"안티쿠스",   syl:"안티" },
  earth:  { base:"테라곤",     syl:"테라" },
};
// 항상 고정된 표준 순서로 정렬 + 중복 제거 → 입력 순서와 무관하게 동일 결과
function canonElems(elements){ return ELEM_KEYS.filter(k=>elements.includes(k)); }
function speciesKey(elements){ return canonElems(elements).join("+"); }
function dragonNameFor(elements){
  const ce = canonElems(elements);
  if(ce.length<=1) return ce.length? ELEM_LORE[ce[0]].base : "알 수 없음";
  return ce.map(k=>ELEM_LORE[k].syl).join("");
}

function makeDragon(grade, elements, grown){
  const g = GRADES[grade];
  const maxHp = g.hp + rand(-8,24);
  const el = canonElems(elements);
  return { id:uid(), name:dragonNameFor(el), grade, elements:el,
           maxHp, hp:maxHp, atk:g.atk+rand(-3,6),
           growth: grown ? 100 : 0, fullness: grown ? 75 : 45 };
}
function randomDragon(grade, mult){
  const cnt = GRADES[grade].count;
  const d = makeDragon(grade, sample(ELEM_KEYS, cnt), true);
  if(mult && mult!==1){ d.maxHp=Math.round(d.maxHp*mult); d.hp=d.maxHp; d.atk=Math.round(d.atk*mult); }
  return d;
}
function calcDamage(atkVal, atkElem, defElems){
  let mult = 1;
  if(ADV[atkElem] && ADV[atkElem].some(e=>defElems.includes(e))) mult = 1.5;
  const base = atkVal * (0.85 + Math.random()*0.35);
  return { dmg: Math.max(1, Math.round(base*mult)), mult };
}

/* ============ 공격 이펙트(파티클) 시스템 ============ */
// 하나의 DOM 파티클을 fx 레이어에 붙이고, 수명이 지나면 자동 제거한다.
function fxNode(fx, opt){
  const e = document.createElement("div");
  e.className = "fx-node";
  if(opt.style) Object.assign(e.style, opt.style);
  if(opt.left!=null) e.style.left = opt.left+"px";
  if(opt.top!=null)  e.style.top  = opt.top+"px";
  if(opt.dx!=null)  e.style.setProperty("--dx", opt.dx+"px");
  if(opt.dy!=null)  e.style.setProperty("--dy", opt.dy+"px");
  if(opt.mx!=null)  e.style.setProperty("--mx", opt.mx+"px");
  if(opt.my!=null)  e.style.setProperty("--my", opt.my+"px");
  if(opt.ang!=null) e.style.setProperty("--ang", opt.ang+"rad");
  if(opt.origin) e.style.transformOrigin = opt.origin;
  if(opt.anim) e.style.animation = opt.anim;
  if(opt.text!=null) e.textContent = opt.text;
  fx.appendChild(e);
  setTimeout(()=>{ try{ e.remove(); }catch(_){} }, opt.life||1000);
  return e;
}
const RAD = Math.PI/180;
function circle(size, c1, c2){
  return { width:size+"px", height:size+"px", borderRadius:"50%",
    background:"radial-gradient(circle at 35% 30%, "+c1+", "+c2+")", boxShadow:"0 0 14px "+c2 };
}
function ring(size, color, w){
  return { width:size+"px", height:size+"px", borderRadius:"50%",
    border:(w||4)+"px solid "+color, boxShadow:"0 0 16px "+color+", inset 0 0 12px "+color };
}
function emojiStyle(px, glow){ return { fontSize:(px||28)+"px", filter:"drop-shadow(0 0 8px "+(glow||"rgba(255,255,255,.6)")+")" }; }

/* ---- 연출 툴킷 ---- */
// 지연 실행(수명 자동 정리용으로 setTimeout 그대로 사용)
function after(ms, f){ setTimeout(f, ms); }
// 방사형 스파크
function sparks(fx,x,y,color,n,dist,delay,size){
  for(let i=0;i<n;i++){ const a=(i/n)*360*RAD+Math.random()*0.4, d=dist*(0.7+Math.random()*0.6);
    fxNode(fx,{left:x,top:y,dx:Math.cos(a)*d,dy:Math.sin(a)*d,style:circle(size||9,"#fff",color),
      anim:"fxBurst .55s ease-out "+(delay||0)+"ms forwards",life:(delay||0)+700}); }
}
// 충격파 링(이중)
function shockwave(fx,x,y,color,delay){
  fxNode(fx,{left:x,top:y,style:ring(60,color,4),anim:"fxRipple .55s ease-out "+(delay||0)+"ms forwards",life:(delay||0)+700});
  fxNode(fx,{left:x,top:y,style:ring(40,"#ffffff",2),anim:"fxRipple2 .5s ease-out "+((delay||0)+60)+"ms forwards",life:(delay||0)+700});
}
// 섬광
function flashAt(fx,x,y,color,size,delay){
  fxNode(fx,{left:x,top:y,style:{width:size+"px",height:size+"px",borderRadius:"50%",
    background:"radial-gradient(circle,#fff,"+color+"00)"},anim:"fxFlash .45s ease-out "+(delay||0)+"ms forwards",life:(delay||0)+600});
}
// 시전자 주변 기 모으기(입자 수렴)
function converge(fx,x,y,color,n,delay){
  for(let i=0;i<(n||8);i++){ const a=(i/(n||8))*360*RAD, d=40+Math.random()*26;
    fxNode(fx,{left:x,top:y,dx:Math.cos(a)*d,dy:Math.sin(a)*d,style:circle(8,"#fff",color),
      anim:"fxSuck .38s ease-in "+((delay||0)+i*18)+"ms forwards",life:(delay||0)+i*18+520}); }
}
// 두 점 사이 빔 (세로 중앙 보정 포함 — 기존 높이/2 오프셋 버그 수정)
function beamLine(fx,ax,ay,tx,ty,h,cssBg,glow,delay,durMs){
  const ang=Math.atan2(ty-ay,tx-ax), dist=Math.hypot(tx-ax,ty-ay);
  fxNode(fx,{left:ax,top:ay,ang,origin:"left center",
    style:{width:dist+"px",height:h+"px",marginTop:(-h/2)+"px",background:cssBg,
           boxShadow:"0 0 18px "+glow,borderRadius:(h/2)+"px"},
    anim:"fxBeam "+((durMs||500)/1000)+"s ease-out "+(delay||0)+"ms forwards",life:(delay||0)+(durMs||500)+150});
}
// 경로 위 점 잔상
function lineDots(fx,ax,ay,tx,ty,n,styleFn,animName,stagger,delay){
  for(let i=0;i<n;i++){ const f=(i+1)/(n+1);
    fxNode(fx,{left:ax+(tx-ax)*f,top:ay+(ty-ay)*f,dx:0,dy:0,style:styleFn(i),
      anim:animName+" .45s ease-out "+((delay||0)+i*(stagger||24))+"ms forwards",life:(delay||0)+i*(stagger||24)+600}); }
}
// 바닥에서 자라는 기둥(넝쿨/물기둥/토네이도 축)
function pillarUp(fx,x,groundY,w,hgt,cssBg,glow,delay,durMs){
  fxNode(fx,{left:x,top:groundY,origin:"bottom center",
    style:{width:w+"px",height:hgt+"px",background:cssBg,boxShadow:"0 0 16px "+glow,borderRadius:(w/2)+"px"},
    anim:"fxVine "+((durMs||600)/1000)+"s ease-out "+(delay||0)+"ms forwards",life:(delay||0)+(durMs||600)+150});
}
// 중력 파편(포물선 낙하 근사)
function debrisArc(fx,x,y,color,n,delay){
  for(let i=0;i<n;i++){ const a=(-30-Math.random()*120)*RAD, sp=40+Math.random()*46;
    fxNode(fx,{left:x,top:y,dx:Math.cos(a)*sp*(Math.random()<.5?-1:1),dy:Math.abs(Math.sin(a))*sp+50,
      style:circle(7+Math.random()*8,"#e7e5e4",color),
      anim:"fxGravity .7s cubic-bezier(.3,0,.8,1) "+((delay||0)+i*20)+"ms forwards",life:(delay||0)+i*20+850}); }
}
// 위로 떠오르는 입자(불티/치유광)
function floatUp(fx,x,y,color,n,delay,emoji){
  for(let i=0;i<n;i++){ const dx=(Math.random()-0.5)*56, dy=42+Math.random()*46;
    fxNode(fx,{left:x,top:y,dx,dy,style: emoji?emojiStyle(13+Math.random()*8,color):circle(7,"#fff",color),
      text: emoji||null, anim:"fxFloat .8s ease-out "+((delay||0)+i*30)+"ms forwards",life:(delay||0)+i*30+950}); }
}
// 표적 지점의 공통 충격(고리 + 섬광 + 스파크)
function impactBurst(fx, tx, ty, c1, c2, delay){
  shockwave(fx,tx,ty,c1,delay||0);
  flashAt(fx,tx,ty,c2,50,(delay||0));
  sparks(fx,tx,ty,c2,8,44,(delay||0),9);
}

// 10종 공격 모션 정의. build(fx, ax, ay, tx, ty, color)
const ATTACK_FX = {
  /* 1) 불 — 화염 브레스: 불티 수렴 → 3중 화염 분사 + 화염핵 빔 → 폭염, 잔불이 위로 피어오름 */
  fire: { name:"화염 브레스", impact:560, dur:1000, build(fx,ax,ay,tx,ty){
    const ang=Math.atan2(ty-ay,tx-ax), dist=Math.hypot(tx-ax,ty-ay);
    converge(fx,ax,ay,"#f97316",8,0);
    flashAt(fx,ax,ay,"#f97316",42,120);
    for(let w=0;w<3;w++) for(let i=0;i<8;i++){
      const sp=(Math.random()-0.5)*(0.62-w*0.14), d=dist*(0.5+w*0.24+Math.random()*0.2);
      fxNode(fx,{left:ax,top:ay,dx:Math.cos(ang+sp)*d,dy:Math.sin(ang+sp)*d,
        style:circle(12+Math.random()*16, w?"#fed7aa":"#fff7ed", i%2?"#f97316":"#ef4444"),
        anim:"fxBreath "+(0.42+w*0.08)+"s ease-out "+(180+w*90+i*16)+"ms forwards",life:1050});
    }
    beamLine(fx,ax,ay,tx,ty,14,"linear-gradient(90deg,#fff7ed,#fb923c,#ef4444)","#f97316",240,420);
    after(540,()=>{
      impactBurst(fx,tx,ty,"#f97316","#ef4444");
      floatUp(fx,tx,ty,"#fb923c",7,80,"🔥");
      for(let i=0;i<3;i++) fxNode(fx,{left:tx+(i-1)*22,top:ty+10,style:emojiStyle(15,"#f97316"),text:"🔥",
        anim:"fxBlink .5s ease-out "+(150+i*90)+"ms forwards",life:900});
    });
  }},
  /* 2) 물 — 격류포: 물방울 수렴·수구 팽창 → 포물선 수구 + 낙하 물방울 궤적 → 물기둥 + 겹물결 + 낙수 */
  water: { name:"격류포", impact:580, dur:1050, build(fx,ax,ay,tx,ty){
    converge(fx,ax,ay,"#3b82f6",9,0);
    fxNode(fx,{left:ax,top:ay,style:circle(34,"#dbeafe","#2563eb"),anim:"fxPop .3s ease-out forwards",life:380});
    const midX=(tx-ax)/2, midY=(ty-ay)/2-46;
    fxNode(fx,{left:ax,top:ay,dx:tx-ax,dy:ty-ay,mx:midX,my:midY,style:circle(30,"#eff6ff","#2563eb"),
      anim:"fxCurve .42s ease-in 200ms forwards",life:720});
    for(let i=0;i<8;i++){ const f=(i+1)/9;
      fxNode(fx,{left:ax+(tx-ax)*f,top:ay+(ty-ay)*f-40*Math.sin(f*Math.PI),dx:(Math.random()-0.5)*20,dy:34+Math.random()*26,
        style:circle(8+Math.random()*6,"#eff6ff","#3b82f6"),
        anim:"fxGravity .5s cubic-bezier(.3,0,.8,1) "+(240+i*26)+"ms forwards",life:240+i*26+650}); }
    after(560,()=>{
      pillarUp(fx,tx,ty+22,26,96,"linear-gradient(#eff6ff,#60a5fa,#1d4ed8)","#3b82f6",0,520);
      shockwave(fx,tx,ty,"#60a5fa",0); shockwave(fx,tx,ty,"#3b82f6",130);
      for(let i=0;i<8;i++){ const a=(-160+i*20)*RAD;
        fxNode(fx,{left:tx,top:ty,dx:Math.cos(a)*46,dy:Math.abs(Math.sin(a))*30+56,style:circle(8,"#eff6ff","#2563eb"),
          anim:"fxGravity .6s cubic-bezier(.3,0,.8,1) "+(i*22)+"ms forwards",life:i*22+750}); }
    });
  }},
  /* 3) 숲 — 가시 넝쿨: 잎 소용돌이 → 씨앗 포물선 → 넝쿨 3줄기 융기 + 가시 방사 + 꽃잎 낙하 */
  forest: { name:"가시 넝쿨", impact:560, dur:1080, build(fx,ax,ay,tx,ty){
    for(let i=0;i<6;i++){ const a=i*60*RAD;
      fxNode(fx,{left:ax+Math.cos(a)*26,top:ay+Math.sin(a)*26,style:emojiStyle(15,"#22c55e"),text:"🍃",
        anim:"fxSuck .4s ease-in "+(i*24)+"ms forwards",life:i*24+540}); }
    fxNode(fx,{left:ax,top:ay,dx:tx-ax,dy:ty-ay,mx:(tx-ax)/2,my:(ty-ay)/2-56,style:emojiStyle(20,"#22c55e"),text:"🌰",
      anim:"fxCurve .4s ease-in 170ms forwards",life:660});
    after(540,()=>{
      pillarUp(fx,tx,ty+24,10,86,"linear-gradient(#bbf7d0,#16a34a,#14532d)","#22c55e",0,560);
      pillarUp(fx,tx-20,ty+24,8,64,"linear-gradient(#bbf7d0,#15803d)","#16a34a",90,520);
      pillarUp(fx,tx+20,ty+24,8,70,"linear-gradient(#bbf7d0,#15803d)","#16a34a",150,520);
      for(let i=0;i<10;i++){ const a=i*36*RAD, d=32+Math.random()*26;
        fxNode(fx,{left:tx,top:ty,dx:Math.cos(a)*d,dy:Math.sin(a)*d,ang:a+90*RAD,
          style:{width:"5px",height:"22px",background:"linear-gradient(#bbf7d0,#15803d)",borderRadius:"3px",boxShadow:"0 0 8px #22c55e"},
          anim:"fxBurst .5s ease-out "+(60+i*14)+"ms forwards",life:800}); }
      impactBurst(fx,tx,ty,"#22c55e","#15803d",60);
      for(let i=0;i<5;i++) fxNode(fx,{left:tx+(Math.random()-0.5)*60,top:ty-30,dx:(Math.random()-0.5)*30,dy:52,
        style:emojiStyle(13,"#4ade80"),text:"🌸",anim:"fxGravity .8s ease-in "+(180+i*60)+"ms forwards",life:180+i*60+950});
    });
  }},
  /* 4) 금속 — 강철 난도: 대장간 스파크·부채꼴 칼날 소환 → 순차 발사(회전 정렬) → X자 절단 + 파편 */
  metal: { name:"강철 난도", impact:520, dur:950, build(fx,ax,ay,tx,ty){
    const ang=Math.atan2(ty-ay,tx-ax), dist=Math.hypot(tx-ax,ty-ay);
    sparks(fx,ax,ay,"#e2e8f0",6,26,0,6);
    for(let i=0;i<5;i++){
      const fan=(i-2)*0.3, bx=ax+Math.cos(ang+fan)*34, by=ay+Math.sin(ang+fan)*34;
      fxNode(fx,{left:bx,top:by,ang:ang,style:{width:"26px",height:"6px",
        background:"linear-gradient(90deg,#f8fafc,#94a3b8,#f8fafc)",boxShadow:"0 0 10px #cbd5e1",borderRadius:"3px"},
        anim:"fxPop .22s ease-out "+(i*46)+"ms forwards",life:i*46+300});
      fxNode(fx,{left:bx,top:by,dx:tx-bx,dy:ty-by,ang:ang,style:{width:"26px",height:"6px",
        background:"linear-gradient(90deg,#f8fafc,#94a3b8)",boxShadow:"0 0 10px #e2e8f0",borderRadius:"3px",
        transform:"translate(-50%,-50%) rotate("+ang+"rad)"},
        anim:"fxProj .26s linear "+(200+i*52)+"ms forwards",life:200+i*52+380});
    }
    after(500,()=>{
      fxNode(fx,{left:tx,top:ty,ang:-38*RAD,style:{width:"120px",height:"6px",background:"linear-gradient(90deg,transparent,#ffffff,transparent)",boxShadow:"0 0 14px #e2e8f0"},anim:"fxSlash .3s ease-out forwards",life:420});
      fxNode(fx,{left:tx,top:ty,ang:38*RAD,style:{width:"120px",height:"6px",background:"linear-gradient(90deg,transparent,#ffffff,transparent)",boxShadow:"0 0 14px #e2e8f0"},anim:"fxSlash .3s ease-out 90ms forwards",life:520});
      impactBurst(fx,tx,ty,"#cbd5e1","#64748b",60);
      debrisArc(fx,tx,ty,"#64748b",6,120);
    });
  }},
  /* 5) 바람 — 나선환: 회오리 링 수렴 → 쌍나선 구체 + 바람 줄기 → 상승 토네이도(회전 링 적층) */
  wind: { name:"나선환", impact:580, dur:1060, build(fx,ax,ay,tx,ty){
    const dx=tx-ax, dy=ty-ay;
    for(let i=0;i<3;i++) fxNode(fx,{left:ax,top:ay,style:ring(30+i*16,"#7dd3fc",3),
      anim:"fxImplode .34s ease-in "+(i*54)+"ms forwards",life:i*54+440});
    fxNode(fx,{left:ax,top:ay,dx,dy,style:ring(30,"#7dd3fc",5),anim:"fxSpiral .46s ease-in 190ms forwards",life:760});
    fxNode(fx,{left:ax,top:ay,dx,dy,mx:dx/2,my:dy/2-34,style:emojiStyle(26,"#38bdf8"),text:"🌀",anim:"fxCurve .46s ease-in 190ms forwards",life:760});
    for(let i=0;i<5;i++){ const off=(i-2)*10;
      beamLine(fx,ax,ay+off,tx,ty+off,2,"linear-gradient(90deg,transparent,#e0f2fe)","#bae6fd",170+i*30,300); }
    after(560,()=>{
      for(let i=0;i<4;i++) fxNode(fx,{left:tx,top:ty+14-i*20,style:ring(58-i*10,"#38bdf8",4),
        anim:"fxSpin .55s linear "+(i*70)+"ms forwards",life:i*70+700});
      impactBurst(fx,tx,ty,"#38bdf8","#0284c7");
      floatUp(fx,tx,ty,"#bae6fd",6,120);
    });
  }},
  /* 6) 공허 — 공허 붕괴: 암흑성 팽창·역광륜 → 왜곡 구체(경로상 링 붕괴) → 대흡수·암흑 신성 폭발 */
  void: { name:"공허 붕괴", impact:700, dur:1150, build(fx,ax,ay,tx,ty){
    const dx=tx-ax, dy=ty-ay;
    fxNode(fx,{left:ax,top:ay,style:circle(30,"#312e81","#000000"),anim:"fxPop .34s ease-out forwards",life:440});
    fxNode(fx,{left:ax,top:ay,style:ring(46,"#a855f7",3),anim:"fxImplode .4s ease-in forwards",life:520});
    fxNode(fx,{left:ax,top:ay,dx,dy,style:circle(24,"#4c1d95","#0b1020"),anim:"fxProj .4s ease-in 230ms forwards",life:700});
    for(let i=0;i<4;i++){ const f=(i+1)/5;
      fxNode(fx,{left:ax+dx*f,top:ay+dy*f,style:ring(34,"#7c3aed",2),
        anim:"fxImplode .36s ease-in "+(230+i*70)+"ms forwards",life:230+i*70+480}); }
    after(620,()=>{
      for(let i=0;i<14;i++){ const a=i*(360/14)*RAD, d=52+Math.random()*32;
        fxNode(fx,{left:tx,top:ty,dx:Math.cos(a)*d,dy:Math.sin(a)*d,style:circle(9,"#ddd6fe","#7c3aed"),
          anim:"fxSuck .5s ease-in "+(i*14)+"ms forwards",life:i*14+640}); }
      fxNode(fx,{left:tx,top:ty,style:circle(78,"#4c1d95","#a855f7"),anim:"fxImplode .55s ease-in 60ms forwards",life:720});
      fxNode(fx,{left:tx,top:ty,style:circle(44,"#0b1020","#7c3aed"),anim:"fxImplode .55s ease-in 130ms forwards",life:800});
      after(430,()=>{ flashAt(fx,tx,ty,"#a855f7",96,0);
        fxNode(fx,{left:tx,top:ty,style:ring(60,"#c4b5fd",3),anim:"fxRipple .5s ease-out forwards",life:620});
        sparks(fx,tx,ty,"#a855f7",10,52,0,8); });
    });
  }},
  /* 7) 신성 — 천벌: 표적 상공 황금 마법진 → 번개+빛기둥 강림 → 십자 섬광 + 깃털빛 낙하 */
  holy: { name:"천벌", impact:620, dur:1100, build(fx,ax,ay,tx,ty){
    const sealY=Math.max(28,ty-170);
    fxNode(fx,{left:tx,top:sealY,style:ring(66,"#facc15",4),anim:"fxRune .55s ease-out forwards",life:700});
    fxNode(fx,{left:tx,top:sealY,style:ring(42,"#fde047",3),anim:"fxRune .55s ease-out 70ms forwards",life:780});
    fxNode(fx,{left:tx,top:sealY,style:emojiStyle(20,"#facc15"),text:"✝️",anim:"fxPop .4s ease-out 120ms forwards",life:620});
    after(380,()=>{
      const h=ty-sealY+26;
      fxNode(fx,{left:tx,top:sealY,style:{width:"8px",height:h+"px",background:"#fffde7",boxShadow:"0 0 18px #fde047",
        clipPath:"polygon(20% 0,80% 0,55% 34%,100% 34%,30% 100%,48% 52%,0 52%)"},origin:"top center",
        anim:"fxPillar .22s ease-out forwards",life:340});
      fxNode(fx,{left:tx,top:sealY,style:{width:"36px",height:h+"px",background:"linear-gradient(#fef9c3,#facc15,rgba(250,204,21,0))",
        boxShadow:"0 0 30px #fde047",borderRadius:"10px"},origin:"top center",anim:"fxPillar .5s ease-out 60ms forwards",life:720});
    });
    after(600,()=>{
      fxNode(fx,{left:tx,top:ty,ang:0,style:{width:"130px",height:"7px",background:"linear-gradient(90deg,transparent,#fff,transparent)",boxShadow:"0 0 16px #fde047"},anim:"fxSlash .34s ease-out forwards",life:460});
      fxNode(fx,{left:tx,top:ty,ang:90*RAD,style:{width:"130px",height:"7px",background:"linear-gradient(90deg,transparent,#fff,transparent)",boxShadow:"0 0 16px #fde047"},anim:"fxSlash .34s ease-out 60ms forwards",life:520});
      impactBurst(fx,tx,ty,"#facc15","#ca8a04");
      for(let i=0;i<7;i++) fxNode(fx,{left:tx+(Math.random()-0.5)*76,top:ty-36,dx:(Math.random()-0.5)*24,dy:58,
        style:emojiStyle(13,"#fde047"),text:"✨",anim:"fxGravity .9s ease-in "+(120+i*70)+"ms forwards",life:120+i*70+1050});
    });
  }},
  /* 8) 고대 — 고대 룬: 석판 룬 3매 부채 소환 → 룬 문자가 청동 쌍빔 위를 활공 → 인장 각인 + 균열 + 흙먼지 */
  ancient: { name:"고대 룬", impact:600, dur:1100, build(fx,ax,ay,tx,ty){
    const runes=["ᚠ","ᚱ","ᛟ"];
    for(let i=0;i<3;i++){ const a=(-40+i*40)*RAD;
      fxNode(fx,{left:ax+Math.cos(a)*36,top:ay+Math.sin(a)*36,style:{fontSize:"18px",color:"#f59e0b",
        textShadow:"0 0 10px #d97706",fontWeight:"900"},text:runes[i],anim:"fxPop .3s ease-out "+(i*70)+"ms forwards",life:i*70+700}); }
    beamLine(fx,ax,ay,tx,ty,9,"linear-gradient(90deg,rgba(180,83,9,0),#f59e0b,#b45309)","#d97706",250,430);
    beamLine(fx,ax,ay,tx,ty,3,"linear-gradient(90deg,rgba(255,255,255,0),#fef3c7)","#fde68a",310,370);
    for(let i=0;i<3;i++){ const f=0.25+i*0.25;
      fxNode(fx,{left:ax,top:ay,dx:(tx-ax),dy:(ty-ay),style:{fontSize:"16px",color:"#fde68a",textShadow:"0 0 8px #f59e0b",fontWeight:"900"},
        text:runes[i],anim:"fxProj .34s linear "+(280+i*60)+"ms forwards",life:280+i*60+460}); }
    after(600,()=>{
      fxNode(fx,{left:tx,top:ty,style:ring(80,"#d97706",4),anim:"fxRune .6s ease-out forwards",life:760});
      fxNode(fx,{left:tx,top:ty,style:ring(52,"#f59e0b",3),anim:"fxRune .6s ease-out 70ms forwards",life:820});
      fxNode(fx,{left:tx,top:ty,style:{fontSize:"26px",color:"#fbbf24",textShadow:"0 0 14px #d97706",fontWeight:"900"},text:"ᛝ",anim:"fxPop .5s ease-out forwards",life:640});
      for(let i=0;i<5;i++){ const a=i*72*RAD;
        fxNode(fx,{left:tx,top:ty,ang:a,style:{width:"56px",height:"3px",background:"linear-gradient(90deg,#78350f,transparent)",boxShadow:"0 0 6px #92400e"},anim:"fxSlash .4s ease-out "+(80+i*40)+"ms forwards",life:640}); }
      impactBurst(fx,tx,ty,"#f59e0b","#b45309");
      debrisArc(fx,tx,ty,"#92400e",5,140);
    });
  }},
  /* 9) 대지 — 메테오: 낙하지점 그림자·경고 링 → 실제 궤도각 운석 + 화염꼬리 → 크레이터·암석 포물선·흙먼지 */
  earth: { name:"메테오", impact:700, dur:1250, build(fx,ax,ay,tx,ty){
    const W=(fx.parentElement?fx.parentElement.clientWidth:700);
    const sx=Math.min(W-30, tx+140), sy=Math.max(12, ty-300);
    const mAng=Math.atan2(ty-sy, tx-sx); // 실제 궤도각 (기존 고정 45deg 버그 수정)
    fxNode(fx,{left:tx,top:ty+16,style:{width:"70px",height:"22px",borderRadius:"50%",background:"radial-gradient(ellipse,rgba(0,0,0,.65),transparent)"},anim:"fxShadow .5s ease-out forwards",life:800});
    fxNode(fx,{left:tx,top:ty,style:ring(50,"#ef4444",3),anim:"fxBlink .5s linear forwards",life:600});
    after(420,()=>{
      fxNode(fx,{left:sx,top:sy,dx:tx-sx,dy:ty-sy,style:{fontSize:"42px",filter:"drop-shadow(0 0 12px #f97316)",
        transform:"translate(-50%,-50%) rotate("+(mAng+2.4)+"rad)"},text:"☄️",anim:"fxProj .3s cubic-bezier(.5,0,1,1) forwards",life:420});
      for(let i=0;i<7;i++){ const f=(i+1)/8;
        fxNode(fx,{left:sx+(tx-sx)*f,top:sy+(ty-sy)*f,style:circle(9+Math.random()*11,"#fed7aa","#ea580c"),
          anim:"fxTrail .34s ease-out "+(i*18)+"ms forwards",life:i*18+480}); }
    });
    after(700,()=>{
      flashAt(fx,tx,ty,"#fdba74",110,0);
      fxNode(fx,{left:tx,top:ty,style:ring(70,"#b45309",6),anim:"fxRipple .6s ease-out forwards",life:760});
      shockwave(fx,tx,ty,"#78350f",90);
      debrisArc(fx,tx,ty,"#78350f",10,40);
      for(let i=0;i<6;i++) fxNode(fx,{left:tx+(i-2.5)*22,top:ty+8,style:{width:"34px",height:"34px",borderRadius:"50%",
        background:"radial-gradient(circle,rgba(120,90,60,.55),transparent)"},anim:"fxFlash .8s ease-out "+(80+i*60)+"ms forwards",life:1050});
      fxNode(fx,{left:tx,top:ty,style:emojiStyle(30,"#b45309"),text:"💥",anim:"fxPop .5s ease-out forwards",life:620});
    });
  }},
};

/* ===== 전설 등급 궁극기: 속성마다 다른 오버드라이브 =====
   각 속성의 기본 모션을 그대로 살리고(고유 정체성) + 충전/컬러 대형 빔/스타버스트를 덧씌운다. */
const ULT_NAMES = {
  fire:"이프리트의 지옥불", water:"심연의 대해일", forest:"세계수의 진노",
  metal:"천공의 강철비", wind:"폭풍군주의 강림", void:"종언의 대공허",
  holy:"신벌: 천상의 심판", ancient:"창세의 룬 붕괴", earth:"대지멸살 메테오",
};
// 속성별 궁극기 전용 시그니처 피니시 (기본기와 완전히 구분되는 개성)
const ULT_ACCENTS = {
  fire(fx,ax,ay,tx,ty){ // 지옥불 기둥 3개가 표적 주변에서 솟구침
    for(let i=0;i<3;i++) pillarUp(fx,tx+(i-1)*34,ty+26,16,110,"linear-gradient(#fff7ed,#fb923c,#7f1d1d)","#ef4444",i*110,560);
    floatUp(fx,tx,ty,"#f97316",10,200,"🔥");
  },
  water(fx,ax,ay,tx,ty){ // 해일 벽이 표적을 휩쓸고 지나감
    fxNode(fx,{left:tx,top:ty,style:{width:"150px",height:"84px",borderRadius:"46% 54% 0 0/90% 100% 0 0",
      background:"linear-gradient(#eff6ff,#3b82f6,#1e3a8a)",boxShadow:"0 0 26px #3b82f6"},origin:"bottom center",
      anim:"fxVine .6s ease-out forwards",life:760});
    shockwave(fx,tx,ty,"#60a5fa",320); shockwave(fx,tx,ty,"#2563eb",460);
  },
  forest(fx,ax,ay,tx,ty){ // 세계수 거목 + 넝쿨 감옥
    pillarUp(fx,tx,ty+30,22,140,"linear-gradient(#bbf7d0,#16a34a,#052e16)","#22c55e",0,640);
    for(let i=0;i<4;i++) pillarUp(fx,tx-42+i*28,ty+30,7,74+((i*37)%38),"linear-gradient(#86efac,#166534)","#22c55e",120+i*80,540);
    fxNode(fx,{left:tx,top:ty-64,style:emojiStyle(30,"#22c55e"),text:"🌳",anim:"fxPop .5s ease-out 320ms forwards",life:960});
  },
  metal(fx,ax,ay,tx,ty){ // 강철비: 하늘에서 칼날 8개 낙하
    for(let i=0;i<8;i++){ const x=tx+(Math.random()-0.5)*110, sy=Math.max(12,ty-210);
      fxNode(fx,{left:x,top:sy,dx:0,dy:ty-sy+(Math.random()*16),style:{width:"5px",height:"26px",
        background:"linear-gradient(#f8fafc,#64748b)",boxShadow:"0 0 8px #cbd5e1",borderRadius:"2px"},
        anim:"fxProj .3s cubic-bezier(.5,0,1,1) "+(i*60)+"ms forwards",life:i*60+430}); }
    sparks(fx,tx,ty,"#e2e8f0",12,58,520,7);
  },
  wind(fx,ax,ay,tx,ty){ // 초대형 쌍폭풍 기둥
    for(let s=0;s<2;s++) for(let i=0;i<5;i++)
      fxNode(fx,{left:tx+(s?26:-26),top:ty+20-i*24,style:ring(64-i*9,"#7dd3fc",4),
        anim:"fxSpin .5s linear "+(s*90+i*60)+"ms forwards",life:s*90+i*60+660});
    floatUp(fx,tx,ty,"#bae6fd",8,220);
  },
  void(fx,ax,ay,tx,ty){ // 특대 블랙홀: 화면의 별을 모조리 흡수 후 붕괴
    for(let i=0;i<18;i++){ const a=i*20*RAD, d=90+Math.random()*46;
      fxNode(fx,{left:tx,top:ty,dx:Math.cos(a)*d,dy:Math.sin(a)*d,style:circle(8,"#ddd6fe","#7c3aed"),
        anim:"fxSuck .6s ease-in "+(i*16)+"ms forwards",life:i*16+760}); }
    fxNode(fx,{left:tx,top:ty,style:circle(120,"#1e1b4b","#a855f7"),anim:"fxImplode .7s ease-in 180ms forwards",life:960});
    after(760,()=>flashAt(fx,tx,ty,"#c4b5fd",130,0));
  },
  holy(fx,ax,ay,tx,ty){ // 삼연 심판 기둥 + 대형 마법진
    const sealY=Math.max(26,ty-180);
    fxNode(fx,{left:tx,top:sealY,style:ring(96,"#facc15",5),anim:"fxRune .7s ease-out forwards",life:880});
    for(let i=0;i<3;i++){ const x=tx+(i-1)*40, h=ty-sealY+30;
      fxNode(fx,{left:x,top:sealY,style:{width:"22px",height:h+"px",background:"linear-gradient(#fef9c3,#facc15,rgba(250,204,21,0))",
        boxShadow:"0 0 22px #fde047",borderRadius:"8px"},origin:"top center",anim:"fxPillar .5s ease-out "+(200+i*130)+"ms forwards",life:200+i*130+700}); }
  },
  ancient(fx,ax,ay,tx,ty){ // 이중 대인장 + 룬 폭풍
    fxNode(fx,{left:tx,top:ty,style:ring(110,"#d97706",5),anim:"fxRune .8s ease-out forwards",life:980});
    fxNode(fx,{left:tx,top:ty,style:ring(76,"#f59e0b",4),anim:"fxRune .8s ease-out 120ms forwards",life:1060});
    const rs=["ᚠ","ᚱ","ᛟ","ᛝ","ᚹ","ᛉ"];
    for(let i=0;i<6;i++){ const a=i*60*RAD;
      fxNode(fx,{left:tx+Math.cos(a)*52,top:ty+Math.sin(a)*52,style:{fontSize:"17px",color:"#fbbf24",
        textShadow:"0 0 10px #d97706",fontWeight:"900"},text:rs[i],anim:"fxPop .5s ease-out "+(160+i*70)+"ms forwards",life:160+i*70+680}); }
  },
  earth(fx,ax,ay,tx,ty){ // 삼연 메테오 (동시 예고 그림자 → 시차 낙하)
    for(let i=0;i<3;i++){ const x=tx+(i-1)*44, delay=i*150;
      fxNode(fx,{left:x,top:ty+14,style:{width:"46px",height:"15px",borderRadius:"50%",background:"radial-gradient(ellipse,rgba(0,0,0,.6),transparent)"},anim:"fxShadow .4s ease-out "+delay+"ms forwards",life:delay+620});
      after(delay+240,()=>{ const sy=Math.max(12,ty-230);
        fxNode(fx,{left:x+70,top:sy,dx:-70,dy:ty-sy,style:{fontSize:"26px",filter:"drop-shadow(0 0 10px #f97316)"},text:"☄️",anim:"fxProj .26s cubic-bezier(.5,0,1,1) forwards",life:380});
        after(270,()=>{ flashAt(fx,x,ty,"#fdba74",64,0); debrisArc(fx,x,ty,"#78350f",5,0); }); });
    }
  },
};
ELEM_KEYS.forEach(k=>{
  const base = ATTACK_FX[k];
  const col = ELEMENTS[k].color;
  ATTACK_FX[k+"_ult"] = {
    name: ULT_NAMES[k], element:k, impact: base.impact+120, dur: base.dur+420,
    build(fx,ax,ay,tx,ty){
      // 공통 충전 연출
      fxNode(fx,{left:ax,top:ay,style:ring(36,col,5),anim:"fxPop .4s ease-out forwards",life:480});
      fxNode(fx,{left:ax,top:ay,style:ring(62,"#ffffff",3),anim:"fxFlash .5s ease-out forwards",life:580});
      converge(fx,ax,ay,col,10,0);
      // 원래 속성 모션 (정체성 유지)
      try{ base.build(fx,ax,ay,tx,ty); }catch(e){}
      // 속성 컬러 대형 빔
      beamLine(fx,ax,ay,tx,ty,20,"linear-gradient(90deg,"+col+"00,"+col+",#ffffff)",col,180,620);
      beamLine(fx,ax,ay,tx,ty,7,"#ffffff","#ffffff",230,570);
      // 시그니처 피니시 + 스타버스트
      setTimeout(()=>{
        try{ ULT_ACCENTS[k](fx,ax,ay,tx,ty); }catch(e){}
        for(let i=0;i<14;i++){ const a=i*(360/14)*RAD, d=54+Math.random()*40;
          fxNode(fx,{left:tx,top:ty,dx:Math.cos(a)*d,dy:Math.sin(a)*d,style:circle(11,"#fff",col),anim:"fxBurst .6s ease-out forwards",life:760}); }
        flashAt(fx,tx,ty,col,110,0);
        impactBurst(fx,tx,ty,col,"#ffffff",60);
      }, base.impact+60);
    }
  };
});

// 드래곤/속성에 따라 사용할 공격 모션 결정 (전설 등급은 선택한 속성별 궁극기)
function pickFxType(dragon, elem){
  if(dragon && dragon.grade==="legendary" && ATTACK_FX[elem+"_ult"]) return elem+"_ult";
  return elem;
}
// 도감/표시용: 특정 속성의 궁극기 이름
function ultNameFor(elem){ const t=ATTACK_FX[elem+"_ult"]; return t?t.name:""; }

/* ============ 각성 시스템 ============
   500골드로 '각성의 비늘'을 사고, 10개를 모아 전설 등급을 각성시킨다.
   각성 시 능력치가 영구 상승하고, 전투에서 속성별 각성 능력을 쓸 수 있다. */
const AWAKEN_COST = 10;   // 각성에 필요한 비늘 수
const SCALE_PRICE = 500;  // 비늘 1개 가격
const AWAKEN_SKILLS = {
  fire:   { name:"업화 강림",   emoji:"🔥", type:"damageAll", pow:1.15, desc:"적 전체를 불태워 큰 피해를 준다." },
  water:  { name:"생명의 성수", emoji:"💧", type:"healAll",   pow:0.40, desc:"아군 전체의 HP를 크게 회복한다." },
  forest: { name:"세계수 소환", emoji:"🌳", type:"shieldAll", pow:0.60, desc:"거대한 나무를 소환해 아군 전체에 강력한 보호막을 두른다." },
  metal:  { name:"강철 방벽",   emoji:"🛡️", type:"shieldAll", pow:0.38, desc:"아군 전체에 강철 보호막을 부여한다." },
  wind:   { name:"질풍 연무",   emoji:"🌪️", type:"aoeExtra",  pow:0.65, desc:"적 전체에 피해를 주고 즉시 한 번 더 행동한다." },
  void:   { name:"공허 잠식",   emoji:"🌌", type:"voidNuke",  pow:2.4,  desc:"가장 강한 적에게 막대한 피해를 주고 공격력을 약화시킨다." },
  holy:   { name:"부활의 빛",   emoji:"✨", type:"revive",    pow:0.5,  desc:"쓰러진 아군 하나를 되살린다. (없으면 전체 회복)" },
  ancient:{ name:"시간 역행",   emoji:"🏛️", type:"healAll",   pow:0.50, desc:"고대의 힘으로 아군 전체 HP를 크게 되돌린다." },
  earth:  { name:"대지 붕괴",   emoji:"🪨", type:"damageAll", pow:1.30, desc:"대지를 뒤흔들어 적 전체에 막대한 피해를 준다." },
};
// 전투 피해 적용(보호막 우선 흡수)
function applyHit(d, dmg){
  let s = d.shield||0, dd = dmg;
  if(s>0){ const a=Math.min(s,dd); s-=a; dd-=a; }
  return {...d, shield:s, hp:Math.max(0, d.hp-dd)};
}
// 각성 후 영구 능력치 강화
function awakenStats(d){
  const maxHp = Math.round(d.maxHp*1.3);
  return {...d, awakened:true, maxHp, hp:maxHp, atk:Math.round(d.atk*1.25)};
}
// 지원기(회복/보호막) 상승 파티클
function spawnSupport(fx, x, y, color, kind){
  // kind: "shield" = 육각 방패 각인, 그 외 = 치유 상승광
  if(kind==="shield"){
    fxNode(fx,{left:x,top:y,style:{width:"58px",height:"58px",background:color+"33",border:"3px solid "+color,
      boxShadow:"0 0 18px "+color+", inset 0 0 14px "+color,
      clipPath:"polygon(50% 0,95% 25%,95% 75%,50% 100%,5% 75%,5% 25%)"},anim:"fxPop .55s ease-out forwards",life:760});
    fxNode(fx,{left:x,top:y,style:ring(66,color,3),anim:"fxRipple2 .6s ease-out 150ms forwards",life:880});
    sparks(fx,x,y,color,6,34,200,6);
  } else {
    floatUp(fx,x,y,color,9,0);
    fxNode(fx,{left:x,top:y-8,style:emojiStyle(20,color),text:"✚",anim:"fxFloat .8s ease-out 100ms forwards",dx:0,dy:44,life:1000});
    fxNode(fx,{left:x,top:y,style:ring(54,color,4),anim:"fxRipple .6s ease-out forwards",life:700});
    pillarUp(fx,x,y+26,30,70,"linear-gradient(rgba(255,255,255,0),"+color+"66,"+color+"22)",color,60,560);
  }
}

/* ============ 공용 UI ============ */
function GradeBadge({grade}){
  const g = GRADES[grade];
  return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
    style={{background:g.color+"22", color:g.color, border:"1px solid "+g.color+"66"}}>{g.name}</span>;
}
function ElemChips({elements, size}){
  const s = size||"text-xs";
  return <div className="flex flex-wrap gap-1">
    {elements.map((e,i)=>(
      <span key={i} className={"px-1.5 py-0.5 rounded-md font-semibold "+s}
        style={{background:ELEMENTS[e].color+"22", color:ELEMENTS[e].color}}>
        {ELEMENTS[e].emoji} {ELEMENTS[e].name}
      </span>
    ))}
  </div>;
}
function StatBar({value, max, color, label}){
  const pct = Math.max(0, Math.min(100, (value/max)*100));
  return <div>
    <div className="flex justify-between text-[10px] text-slate-400 mb-0.5"><span>{label}</span><span>{Math.round(value)}/{max}</span></div>
    <div className="bar"><div style={{width:pct+"%", background:color}}></div></div>
  </div>;
}

/* ============ 보육원 드래곤 카드 ============ */
function NurseryCard({d, onFeed, onClean, selectable, selected, onSelect, disabled, onAwaken, scales}){
  const g = GRADES[d.grade];
  const canAwaken = onAwaken && d.grade==="legendary" && !d.awakened;
  return (
    <div onClick={()=> selectable && !disabled && onSelect && onSelect(d)}
      className={"rounded-2xl p-3 border bg-slate-900/70 fade "+(selected?"ring-2":"")+(selectable&&!disabled?" cursor-pointer hover:bg-slate-800/70":"")+(disabled?" opacity-40":"")}
      style={{borderColor: d.awakened?"#fbbf24":g.color+"55", boxShadow: selected?"0 0 0 2px "+g.color : (d.awakened?"0 0 14px #fbbf2466":"none")}}>
      <div className="flex items-center gap-2 mb-2">
        <div className="text-3xl glow">{d.awakened?"🌟":DRAGON_EMOJI[d.grade]}</div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-100">{d.name}</span><GradeBadge grade={d.grade}/>
            {d.awakened && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/50">✨각성</span>}
          </div>
          <ElemChips elements={d.elements}/>
        </div>
      </div>
      <div className="space-y-1.5">
        <StatBar value={d.hp} max={d.maxHp} color="#ef4444" label="HP"/>
        <div className="text-[11px] text-amber-300 font-semibold">⚔️ 공격력 {d.atk}</div>
        <StatBar value={d.growth} max={100} color="#22c55e" label="성장도"/>
        <StatBar value={d.fullness} max={100} color="#f59e0b" label="포만감"/>
      </div>
      {onFeed && (
        <div className="flex gap-2 mt-3">
          <button onClick={(e)=>{e.stopPropagation(); onFeed(d);}}
            className="flex-1 text-xs font-bold py-1.5 rounded-lg bg-amber-500/90 hover:bg-amber-400 text-slate-900">🍖 먹이주기 (20G)</button>
          <button onClick={(e)=>{e.stopPropagation(); onClean(d);}}
            className="flex-1 text-xs font-bold py-1.5 rounded-lg bg-sky-500/90 hover:bg-sky-400 text-slate-900">🧹 청소하기</button>
        </div>
      )}
      {canAwaken && (
        <button onClick={(e)=>{e.stopPropagation(); onAwaken(d);}} disabled={(scales||0)<AWAKEN_COST}
          className="w-full mt-2 text-xs font-black py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-900 disabled:opacity-40">
          🌟 각성시키기 (비늘 {scales||0}/{AWAKEN_COST})
        </button>
      )}
      {d.awakened && <div className="mt-2 text-center text-[11px] text-amber-300 font-bold">🌟 각성 완료 · 전투에서 각성기 사용 가능</div>}
      {!d.awakened && d.growth>=100 && <div className="mt-2 text-center text-[11px] text-emerald-400 font-bold">✅ 다 자랐어요! (교배/전투 가능)</div>}
    </div>
  );
}

/* ============ 전투 드래곤 카드 ============ */
const BattleCard = React.forwardRef(({d, isEnemy, selected, targetable, onClick, dead}, ref)=>{
  const g = GRADES[d.grade];
  return (
    <div ref={ref} onClick={onClick}
      className={"rounded-xl p-2 border bg-slate-900/80 transition "+(dead?"opacity-30 grayscale":"")+(targetable?" cursor-crosshair hover:ring-2 hover:ring-red-400":"")+(selected?" ring-2 ring-emerald-400":"")}
      style={{borderColor: d.awakened?"#fbbf24":g.color+"66", boxShadow: d.awakened&&!dead?"0 0 10px #fbbf2455":"none"}}>
      <div className="flex items-center gap-2">
        <div className="text-2xl">{dead?"💀":(d.awakened?"🌟":DRAGON_EMOJI[d.grade])}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="font-bold text-xs text-slate-100 truncate">{d.name}</span><GradeBadge grade={d.grade}/>
            {d.shield>0 && <span className="text-[10px] font-bold text-sky-300 whitespace-nowrap">🛡️{d.shield}</span>}
          </div>
          <ElemChips elements={d.elements} size="text-[10px]"/>
        </div>
      </div>
      <div className="mt-1"><StatBar value={Math.max(0,d.hp)} max={d.maxHp} color={isEnemy?"#f87171":"#34d399"} label="HP"/></div>
    </div>
  );
});

/* ============ 전투 화면 ============ */
function BattleArena({left, right, leftName, rightName, leftIsAI, rightIsAI, onExit, network, incomingAttack}){
  const [L, setL] = useState(()=>left.map(d=>({...d, shield:0})));
  const [R, setR] = useState(()=>right.map(d=>({...d, shield:0})));
  const [turn, setTurn] = useState("left");
  const [selDragon, setSelDragon] = useState(0);
  const [selElem, setSelElem] = useState(null);
  const [selTarget, setSelTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState(["⚔️ 전투 시작!"]);
  const [finished, setFinished] = useState(false);
  const [winner, setWinner] = useState(null);
  const [usedAwaken, setUsedAwaken] = useState([]); // 각성기를 이미 쓴 드래곤 id
  const containerRef = useRef(null);
  const fxRef = useRef(null);
  const cardRefs = useRef({});

  const addLog = m => setLog(l => [m, ...l].slice(0,6));

  // 승패 판정
  useEffect(()=>{
    if(finished) return;
    const lDead = L.every(d=>d.hp<=0), rDead = R.every(d=>d.hp<=0);
    if(rDead || lDead){ setWinner(rDead ? "left":"right"); setFinished(true); }
  }, [L, R, finished]);

  // 턴 전환 시 살아있는 첫 드래곤 선택
  useEffect(()=>{
    const arr = turn==="left"?L:R;
    const idx = arr.findIndex(d=>d.hp>0);
    setSelDragon(idx<0?0:idx); setSelElem(null);
    const enemy = turn==="left"?R:L;
    setSelTarget(enemy.findIndex(d=>d.hp>0));
  }, [turn]);

  // 공격 모션 재생: fx 레이어에 파티클을 그리고, impact 시점에 onImpact 실행. 총 재생시간(ms) 반환.
  function playAttackFx(type, fromEl, toEl, onImpact){
    const cfg = ATTACK_FX[type] || ATTACK_FX.fire;
    const fx = fxRef.current, cont = containerRef.current;
    if(fx && cont && fromEl && toEl){
      const c = cont.getBoundingClientRect();
      const a = fromEl.getBoundingClientRect(), b = toEl.getBoundingClientRect();
      const ax = a.left+a.width/2-c.left, ay = a.top+a.height/2-c.top;
      const tx = b.left+b.width/2-c.left, ty = b.top+b.height/2-c.top;
      try{ cfg.build(fx, ax, ay, tx, ty, ELEMENTS[type] ? ELEMENTS[type].color : "#fff"); }catch(e){}
    }
    setTimeout(onImpact, cfg.impact);
    return cfg.dur;
  }

  function performAttack(side, di, elem, ti, remote){
    setBusy(true);
    const atkArr = side==="left"?L:R;
    const defArr = side==="left"?R:L;
    if(!atkArr[di] || !defArr[ti]){ setBusy(false); return; }
    const calc = remote ? {dmg:remote.dmg, mult:remote.mult} : calcDamage(atkArr[di].atk, elem, defArr[ti].elements);
    const dmg = calc.dmg, mult = calc.mult;
    const type = pickFxType(atkArr[di], elem);
    const moveName = (ATTACK_FX[type] || ATTACK_FX.fire).name;
    const fromEl = cardRefs.current[(side==="left"?"L":"R")+di];
    const toEl = cardRefs.current[(side==="left"?"R":"L")+ti];
    const setDef = side==="left"?setR:setL;
    const atkName = atkArr[di].name, defName = defArr[ti].name;
    const dur = playAttackFx(type, fromEl, toEl, ()=>{
      setDef(prev=>{ const n=prev.map(d=>({...d})); n[ti]=applyHit(n[ti], dmg); return n; });
      if(toEl){ toEl.classList.add("shake"); setTimeout(()=>toEl && toEl.classList.remove("shake"),400); }
      addLog((side==="left"?"🟢 ":"🔴 ")+atkName+"의 «"+moveName+"» → "+defName+" ["+dmg+" 피해"+(mult>1?" · 효과적!":"")+"]");
      if(network && !remote) network.send({kind:"attack", side, di, elem, ti, dmg, mult});
    });
    setTimeout(()=>{ setTurn(side==="left"?"right":"left"); setBusy(false); }, dur+160);
  }

  // 각성기 사용 (전투에서 각성한 드래곤이 속성별 특수 능력 발동)
  function performAwaken(side, di, elem, remote){
    const skill = AWAKEN_SKILLS[elem];
    if(!skill){ return; }
    setBusy(true);
    const allyArr = side==="left"?L:R, enemyArr = side==="left"?R:L;
    const setAlly = side==="left"?setL:setR, setEnemy = side==="left"?setR:setL;
    const caster = allyArr[di];
    if(!caster){ setBusy(false); return; }
    if(!remote) setUsedAwaken(u=> u.includes(caster.id)?u:[...u, caster.id]);
    const casterEl = cardRefs.current[(side==="left"?"L":"R")+di];
    const dmgType = (skill.type==="damageAll"||skill.type==="aoeExtra"||skill.type==="voidNuke");
    // voidNuke 대상: 가장 HP 높은 적
    let nukeIdx = -1;
    if(skill.type==="voidNuke"){ let best=-1; enemyArr.forEach((d,i)=>{ if(d.hp>0 && d.hp>best){best=d.hp; nukeIdx=i;} }); }

    // 이펙트
    const fx=fxRef.current, cont=containerRef.current;
    if(fx && cont && casterEl){
      const c=cont.getBoundingClientRect();
      const centerOf=(el)=>{ const b=el.getBoundingClientRect(); return {x:b.left+b.width/2-c.left, y:b.top+b.height/2-c.top}; };
      const cc=centerOf(casterEl); const col=ELEMENTS[elem].color;
      fxNode(fx,{left:cc.x,top:cc.y,style:emojiStyle(42),text:skill.emoji,anim:"fxPop .6s ease-out forwards",life:720});
      fxNode(fx,{left:cc.x,top:cc.y,style:ring(64,col,5),anim:"fxFlash .5s ease-out forwards",life:600});
      const tgtArr = dmgType ? enemyArr : allyArr;
      const prefix = dmgType ? (side==="left"?"R":"L") : (side==="left"?"L":"R");
      tgtArr.forEach((d,i)=>{
        if(skill.type==="voidNuke" && i!==nukeIdx) return;
        if(d.hp<=0 && skill.type!=="revive") return;
        const el=cardRefs.current[prefix+i]; if(!el) return; const p=centerOf(el);
        if(dmgType){ try{ (ATTACK_FX[elem]||ATTACK_FX.fire).build(fx, cc.x, cc.y, p.x, p.y); }catch(e){} }
        else { spawnSupport(fx, p.x, p.y, col, skill.type==="shieldAll"?"shield":"heal"); }
      });
    }

    const impact = 560, dur = 1150;
    setTimeout(()=>{
      const P = skill.pow;
      if(skill.type==="damageAll" || skill.type==="aoeExtra"){
        const amt = Math.round(caster.atk*P);
        setEnemy(prev=> prev.map(d=> d.hp>0 ? applyHit(d, amt) : d));
      } else if(skill.type==="voidNuke"){
        const amt = Math.round(caster.atk*P);
        setEnemy(prev=> prev.map((d,i)=> i===nukeIdx && d.hp>0 ? {...applyHit(d, amt), atk:Math.max(1,Math.round(d.atk*0.5))} : d));
      } else if(skill.type==="healAll"){
        setAlly(prev=> prev.map(d=> d.hp>0 ? {...d, hp:Math.min(d.maxHp, d.hp+Math.round(d.maxHp*P))} : d));
      } else if(skill.type==="shieldAll"){
        setAlly(prev=> prev.map(d=> d.hp>0 ? {...d, shield:(d.shield||0)+Math.round(d.maxHp*P)} : d));
      } else if(skill.type==="revive"){
        setAlly(prev=>{ const n=prev.map(d=>({...d})); const idx=n.findIndex(d=>d.hp<=0);
          if(idx>=0){ n[idx].hp=Math.round(n[idx].maxHp*P); }
          else { n.forEach(d=>{ if(d.hp>0) d.hp=Math.min(d.maxHp, d.hp+Math.round(d.maxHp*0.3)); }); }
          return n; });
      }
      addLog((side==="left"?"🟢 ":"🔴 ")+caster.name+"의 각성기 ✦"+skill.name+"✦ 발동!");
      if(network && !remote) network.send({kind:"awaken", side, di, elem});
    }, impact);

    const extra = skill.type==="aoeExtra";
    setTimeout(()=>{ if(!extra) setTurn(side==="left"?"right":"left"); setBusy(false); }, dur);
  }

  // AI 자동 행동 (온라인 대전에서는 leftIsAI/rightIsAI가 항상 false라 동작하지 않음)
  useEffect(()=>{
    if(finished || busy) return;
    const aiSide = (turn==="left"&&leftIsAI)||(turn==="right"&&rightIsAI) ? turn : null;
    if(!aiSide) return;
    const t = setTimeout(()=>{
      const atkArr = aiSide==="left"?L:R, defArr = aiSide==="left"?R:L;
      const alive = atkArr.map((d,i)=>({d,i})).filter(x=>x.d.hp>0);
      const targets = defArr.map((d,i)=>({d,i})).filter(x=>x.d.hp>0).sort((a,b)=>a.d.hp-b.d.hp);
      if(!alive.length || !targets.length) return;
      const ch = pick(alive);
      performAttack(aiSide, ch.i, pick(ch.d.elements), targets[0].i);
    }, 800);
    return ()=>clearTimeout(t);
  }, [turn, busy, finished]);

  // 온라인 대전: 상대 기기에서 온 공격을 그대로(같은 피해량으로) 재현
  const lastIncomingRef = useRef(null);
  useEffect(()=>{
    if(!incomingAttack) return;
    if(lastIncomingRef.current === incomingAttack.counter) return;
    lastIncomingRef.current = incomingAttack.counter;
    if(incomingAttack.kind === "awaken"){
      performAwaken(incomingAttack.side, incomingAttack.di, incomingAttack.elem, true);
    } else {
      performAttack(incomingAttack.side, incomingAttack.di, incomingAttack.elem, incomingAttack.ti, incomingAttack);
    }
  }, [incomingAttack]);

  const curIsHuman = network ? (turn===network.mySide) : ((turn==="left"&&!leftIsAI)||(turn==="right"&&!rightIsAI));
  const curArr = turn==="left"?L:R;
  const enemyArr = turn==="left"?R:L;
  const curDragon = curArr[selDragon];

  function humanAttack(){
    if(busy||finished||!curIsHuman) return;
    if(!curDragon||curDragon.hp<=0) return;
    const elem = selElem || curDragon.elements[0];
    let tgt = selTarget;
    if(tgt==null || !enemyArr[tgt] || enemyArr[tgt].hp<=0) tgt = enemyArr.findIndex(d=>d.hp>0);
    if(tgt<0) return;
    performAttack(turn, selDragon, elem, tgt);
  }
  function humanAwaken(){
    if(busy||finished||!curIsHuman) return;
    if(!curDragon||curDragon.hp<=0||!curDragon.awakened) return;
    if(usedAwaken.includes(curDragon.id)) return;
    const elem = selElem || curDragon.elements[0];
    performAwaken(turn, selDragon, elem);
  }
  const curElem = curDragon ? (selElem || curDragon.elements[0]) : null;
  const canAwakenNow = curDragon && curDragon.awakened && !usedAwaken.includes(curDragon.id);

  return (
    <div ref={containerRef} className="relative">
      {/* 공격 이펙트가 그려지는 레이어 (imperative DOM) */}
      <div ref={fxRef} className="fx-layer"></div>

      <div className="grid grid-cols-2 gap-3 md:gap-6">
        <div>
          <div className="text-center font-bold mb-2 text-emerald-400">🟢 {leftName} {turn==="left"&&!finished?"◀ 턴":""}</div>
          <div className="space-y-2">
            {L.map((d,i)=>(
              <BattleCard key={d.id} ref={el=>cardRefs.current["L"+i]=el} d={d} dead={d.hp<=0}
                selected={turn==="left"&&curIsHuman&&selDragon===i}
                targetable={turn==="right"&&curIsHuman&&d.hp>0}
                onClick={()=>{ if(busy)return;
                  if(turn==="left"&&curIsHuman&&d.hp>0) setSelDragon(i);
                  else if(turn==="right"&&curIsHuman&&d.hp>0) setSelTarget(i); }}/>
            ))}
          </div>
        </div>
        <div>
          <div className="text-center font-bold mb-2 text-red-400">🔴 {rightName} {turn==="right"&&!finished?"◀ 턴":""}</div>
          <div className="space-y-2">
            {R.map((d,i)=>(
              <BattleCard key={d.id} ref={el=>cardRefs.current["R"+i]=el} d={d} isEnemy dead={d.hp<=0}
                selected={turn==="right"&&curIsHuman&&selDragon===i}
                targetable={turn==="left"&&curIsHuman&&d.hp>0}
                onClick={()=>{ if(busy)return;
                  if(turn==="right"&&curIsHuman&&d.hp>0) setSelDragon(i);
                  else if(turn==="left"&&curIsHuman&&d.hp>0) setSelTarget(i); }}/>
            ))}
          </div>
        </div>
      </div>

      {/* 컨트롤 */}
      <div className="mt-4 rounded-2xl bg-slate-900/80 border border-slate-700 p-3">
        {finished ? (
          <div className="text-center py-2">
            <div className="text-2xl font-black mb-2">{
              network
              ? (winner===network.mySide ? "🎉 승리!" : "💥 패배했어요...")
              : ((winner==="left"&&!leftIsAI)||(winner==="right"&&!rightIsAI)
                ? "🎉 승리!" : "💥 "+(winner==="left"?leftName:rightName)+" 승리!")}</div>
            <button onClick={()=>onExit(winner)} className="px-6 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 font-bold text-white">돌아가기</button>
          </div>
        ) : curIsHuman ? (
          <div>
            <div className="text-xs text-slate-300 mb-2">
              <b className="text-emerald-400">{turn==="left"?leftName:rightName}</b> 차례 · 공격할 <b>{curDragon?curDragon.name:"-"}</b>의 속성을 고르고, 오른쪽 적을 클릭해 대상을 정하세요.
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              {curDragon && curDragon.elements.map(e=>(
                <button key={e} onClick={()=>setSelElem(e)}
                  className={"chip px-3 py-1.5 rounded-lg text-sm font-bold "+((selElem||curDragon.elements[0])===e?"ring-2":"")}
                  style={{background:ELEMENTS[e].color+"33", color:ELEMENTS[e].color, boxShadow:(selElem||curDragon.elements[0])===e?"0 0 0 2px "+ELEMENTS[e].color:"none"}}>
                  {ELEMENTS[e].emoji} {ELEMENTS[e].name}
                </button>
              ))}
            </div>
            {curDragon && (
              <div className="text-[11px] text-slate-400 mb-2">
                🎬 공격 모션: <b className="text-slate-200">{(ATTACK_FX[pickFxType(curDragon, curElem)]||ATTACK_FX.fire).name}</b>
                {curDragon.grade==="legendary" && <span className="text-amber-300"> (전설 궁극기!)</span>}
                {canAwakenNow && curElem && <span className="text-amber-200"> · 각성기: {AWAKEN_SKILLS[curElem].emoji} {AWAKEN_SKILLS[curElem].name}</span>}
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={humanAttack} disabled={busy}
                className={(canAwakenNow?"flex-1 ":"w-full ")+"py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-400 hover:to-orange-400 font-black text-white disabled:opacity-50"}>
                🎯 공격! {selTarget!=null&&enemyArr[selTarget]?"→ "+enemyArr[selTarget].name:""}
              </button>
              {canAwakenNow && curElem && (
                <button onClick={humanAwaken} disabled={busy}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-300 hover:from-amber-300 font-black text-slate-900 disabled:opacity-50">
                  🌟 각성기! ({AWAKEN_SKILLS[curElem].name})
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center text-slate-400 py-3 animate-pulse">
            {network ? "⏳ 상대방의 턴을 기다리는 중..." : "🤖 "+(turn==="left"?leftName:rightName)+" 생각 중..."}
          </div>
        )}
      </div>

      <div className="mt-3 rounded-xl bg-black/40 border border-slate-800 p-2 text-[11px] text-slate-300 space-y-0.5 h-24 overflow-auto">
        {log.map((l,i)=><div key={i} className={i===0?"text-slate-100":""}>{l}</div>)}
      </div>
    </div>
  );
}

/* ============ 메인 앱 ============ */
function Game(){
  const initialSaveRef = useRef(loadSave());
  const initSave = initialSaveRef.current;

  const [tab, setTab] = useState("nursery");
  const [gold, setGold] = useState(()=> initSave ? initSave.gold : 600);
  const [day, setDay] = useState(()=> initSave ? initSave.day : 1);
  const [dragons, setDragons] = useState(()=> initSave ? initSave.dragons : [
    makeDragon("common", ["fire"], true),
    makeDragon("common", ["water"], true),
    makeDragon("rare", ["forest","wind"], true),
  ]);
  const [eggs, setEggs] = useState(()=> initSave ? initSave.eggs : []);
  const [dex, setDex] = useState(()=> initSave && initSave.dex ? initSave.dex : {}); // 발견한 종족 { speciesKey: true }
  const [scales, setScales] = useState(()=> initSave && initSave.scales ? initSave.scales : 0); // 각성의 비늘
  const [toast, setToast] = useState(null);
  const [evt, setEvt] = useState(null);
  const [saveModal, setSaveModal] = useState(null); // {mode:'export'|'import', code, text}

  const notify = m => { setToast(m); setTimeout(()=>setToast(t=>t===m?null:t), 2200); };

  // 저장 데이터를 불러왔다면 id 카운터가 겹치지 않도록 앞으로 당겨두고, 안내 토스트를 띄운다.
  useEffect(()=>{
    if(!initSave) return;
    const ids = [...initSave.dragons.map(d=>d.id), ...initSave.eggs.map(e=>e.id)];
    if(ids.length) _id = Math.max(_id, Math.max(...ids)+1);
    notify("💾 저장된 게임을 불러왔어요!");
  }, []);

  // 보유/알 드래곤의 종족을 도감에 자동 등록
  useEffect(()=>{
    setDex(prev=>{
      const next={...prev}; let changed=false;
      dragons.forEach(d=>{ const k=speciesKey(d.elements); if(!next[k]){ next[k]=true; changed=true; } });
      eggs.forEach(e=>{ const k=speciesKey(e.elements); if(!next[k]){ next[k]=true; changed=true; } });
      return changed?next:prev;
    });
  }, [dragons, eggs]);

  // 상태가 바뀔 때마다 이 기기의 브라우저에 자동 저장
  useEffect(()=>{
    saveLocal({gold, day, dragons, eggs, dex, scales});
  }, [gold, day, dragons, eggs, dex, scales]);

  /* ----- 각성 ----- */
  function buyScale(){
    if(gold<SCALE_PRICE){ notify("💰 골드가 부족해요! (500G 필요)"); return; }
    setGold(g=>g-SCALE_PRICE); setScales(s=>s+1);
    notify("🌟 각성의 비늘을 구매했어요!");
  }
  function awaken(d){
    if(d.grade!=="legendary"){ notify("전설 등급만 각성할 수 있어요."); return; }
    if(d.awakened){ notify("이미 각성한 드래곤이에요."); return; }
    if(scales<AWAKEN_COST){ notify("각성의 비늘이 부족해요! ("+scales+"/"+AWAKEN_COST+")"); return; }
    setScales(s=>s-AWAKEN_COST);
    setDragons(ds=>ds.map(x=> x.id===d.id ? awakenStats(x) : x));
    setEvt({title:"각성 성공!", emoji:"🌟", result:d.name+"이(가) 각성했어요! 능력치가 영구 상승하고, 전투에서 속성별 각성기를 사용할 수 있어요. (HP +30%, 공격 +25%)"});
  }

  /* ----- 보육원 ----- */
  function feed(d){
    if(gold<20){ notify("💰 골드가 부족해요!"); return; }
    setGold(g=>g-20);
    setDragons(ds=>ds.map(x=>x.id===d.id?{...x, fullness:Math.min(100,x.fullness+30)}:x));
  }
  function clean(d){
    setDragons(ds=>ds.map(x=>x.id===d.id?{...x, growth:Math.min(100,x.growth+4), fullness:Math.min(100,x.fullness+5)}:x));
    notify("🧹 "+d.name+"의 둥지를 청소했어요!");
  }

  /* ----- 랜덤 이벤트 13종 ----- */
  const EVENTS = [
    { id:1, title:"밀렵꾼의 습격", emoji:"🏹",
      desc:"드래곤을 노리는 밀렵꾼이 나타났어요! 어떻게 할까요?",
      choices:[
        { label:"함정으로 방어 (150G)", run:()=>{ if(gold>=150){setGold(g=>g-150); return "함정으로 밀렵꾼을 쫓아냈어요! (-150G)";} return "골드가 없어 피해를 입었어요..."; } },
        { label:"그냥 버틴다", run:()=>{ const loss=Math.round(gold*0.35); setGold(g=>g-loss); return "밀렵꾼이 골드를 훔쳐갔어요! (-"+loss+"G)"; } },
      ] },
    { id:2, title:"떠돌이 상인", emoji:"🧳",
      desc:"값비싼 영양제를 파는 상인이 방문했어요. 구매하시겠어요?",
      choices:[
        { label:"구매 (200G)", run:()=>{ if(gold>=200){ setGold(g=>g-200); setDragons(ds=>ds.map(x=>({...x, fullness:100, atk:x.atk+3}))); return "모든 드래곤이 배불리 먹고 공격력이 +3 올랐어요!"; } return "골드가 부족해요..."; } },
        { label:"거절", run:()=>"상인은 아쉬워하며 떠났어요." },
      ] },
    { id:3, title:"마을의 후원금", emoji:"🎁", auto:()=>{ setGold(g=>g+300); return "마을에서 후원금 300G를 보내왔어요!"; } },
    { id:4, title:"드래곤 독감 유행", emoji:"🤒", auto:()=>{ setDragons(ds=>ds.map(x=>({...x, fullness:Math.max(0,x.fullness-30)}))); return "독감이 돌아 모든 드래곤의 포만감이 30 감소했어요."; } },
    { id:5, title:"희귀 광맥 발견", emoji:"💎", auto:()=>{ setGold(g=>g+800); return "보육원 뒷산에서 희귀 광맥을 발견! +800G!"; } },
    { id:6, title:"신비한 마법사 방문", emoji:"🧙", auto:()=>{ let nm=""; setDragons(ds=>{ if(!ds.length) return ds; const i=rand(0,ds.length-1); nm=ds[i].name; return ds.map((x,j)=>j===i?{...x, growth:100}:x); }); return "마법사가 드래곤 하나의 성장도를 MAX로 만들었어요!"; } },
    { id:7, title:"알 도둑 침입", emoji:"🥷",
      desc:"수상한 도둑이 알을 노리고 있어요!",
      choices:[
        { label:"함정 설치 (100G)", run:()=>{ if(gold>=100){ setGold(g=>g-100); return "함정으로 알을 지켜냈어요! (-100G)"; } return "막지 못했지만 다행히 놓쳤어요."; } },
        { label:"방치한다", run:()=>{ let lost=false; setEggs(es=>{ if(es.length){lost=true; return es.slice(1);} return es;}); return lost?"알 하나를 도둑맞았어요...":"다행히 훔쳐갈 알이 없었어요."; } },
      ] },
    { id:8, title:"대풍년", emoji:"🌾", auto:()=>{ setDragons(ds=>ds.map(x=>({...x, fullness:100}))); return "대풍년! 모든 드래곤을 공짜로 배불리 먹였어요!"; } },
    { id:9, title:"보육원 시설 고장", emoji:"🔧", auto:()=>{ setGold(g=>Math.max(0,g-150)); return "시설이 고장나 수리비 150G를 지출했어요."; } },
    { id:10, title:"길 잃은 아기 드래곤", emoji:"🐣", auto:()=>{ setDragons(ds=>[...ds, makeDragon("common", sample(ELEM_KEYS,1), true)]); return "길 잃은 아기 드래곤(일반)을 새 식구로 맞이했어요!"; } },
    { id:11, title:"고대 유적의 공명", emoji:"🏛️", auto:()=>{ let n=0; setEggs(es=>{ n=es.length; setDragons(ds=>[...ds, ...es.map(e=>makeDragon(e.grade, e.elements, false))]); return []; }); return n>0?("고대의 힘으로 알 "+n+"개가 모두 부화했어요!"):"부화할 알이 없었어요."; } },
    { id:12, title:"먹이 창고 오염", emoji:"🦠",
      desc:"먹이 창고가 오염됐어요. 정화하시겠어요?",
      choices:[
        { label:"정화 (120G)", run:()=>{ if(gold>=120){ setGold(g=>g-120); return "창고를 정화했어요! (-120G)"; } return "골드가 없어 정화하지 못했어요..."; } },
        { label:"방치", run:()=>{ setDragons(ds=>ds.map(x=>({...x, fullness:Math.max(0,x.fullness-30)}))); return "오염된 먹이로 포만감이 30 감소했어요."; } },
      ] },
    { id:13, title:"전설 드래곤의 축복", emoji:"🌟", auto:()=>{ setDragons(ds=>ds.map(x=>({...x, maxHp:x.maxHp+30, hp:x.maxHp+30, atk:x.atk+8}))); return "전설의 드래곤이 축복을 내려 모든 드래곤이 영구 강화됐어요! (HP+30, 공격+8)"; } },
  ];

  function nextDay(){
    setDay(d=>d+1);
    // 성장/포만감 처리
    setDragons(ds=>ds.map(x=>{
      let growth=x.growth, hp=x.hp, fullness=x.fullness;
      if(fullness>=40 && growth<100) growth=Math.min(100, growth+rand(9,16));
      if(fullness<20) hp=Math.max(1, hp-rand(5,15));
      fullness=Math.max(0, fullness-rand(15,25));
      return {...x, growth, hp, fullness};
    }));
    // 알 부화 카운트다운
    setEggs(es=>{
      const remain=[]; const hatched=[];
      es.forEach(e=>{ const dl=e.daysLeft-1; if(dl<=0) hatched.push(makeDragon(e.grade, e.elements, false)); else remain.push({...e, daysLeft:dl}); });
      if(hatched.length){ setDragons(ds=>[...ds, ...hatched]); setTimeout(()=>notify("🐣 알 "+hatched.length+"개가 부화했어요!"),50); }
      return remain;
    });
    // 30% 이벤트
    if(Math.random()<0.30){
      const e = pick(EVENTS);
      if(e.auto){ const msg=e.auto(); setEvt({title:e.title, emoji:e.emoji, result:msg}); }
      else { setEvt({title:e.title, emoji:e.emoji, desc:e.desc, choices:e.choices}); }
    } else {
      notify("🌙 "+ (day+1) +"일차 · 평화로운 하루가 지났어요.");
    }
  }

  /* ----- 교배 ----- */
  const [breedSel, setBreedSel] = useState([]);
  function toggleBreed(d){
    if(d.growth<100){ notify("아직 다 자라지 않았어요 (성장도 100 필요)"); return; }
    setBreedSel(s=> s.find(x=>x===d.id) ? s.filter(x=>x!==d.id) : (s.length<2 ? [...s, d.id] : [s[1], d.id]));
  }
  function breed(){
    if(breedSel.length!==2){ notify("교배할 드래곤 2마리를 골라주세요."); return; }
    if(gold<100){ notify("교배 비용 100G가 부족해요."); return; }
    const p1 = dragons.find(d=>d.id===breedSel[0]), p2 = dragons.find(d=>d.id===breedSel[1]);
    setGold(g=>g-100);
    let elems = uniq([...p1.elements, ...p2.elements]);
    let mutated=false;
    if(Math.random()<0.22){ const extra=ELEM_KEYS.filter(e=>!elems.includes(e)); if(extra.length){ elems.push(pick(extra)); mutated=true; } }
    if(elems.length>4) elems = sample(elems,4);
    const grade = gradeByCount(elems.length);
    setEggs(es=>[...es, { id:uid(), grade, elements:elems, daysLeft:rand(2,3) }]);
    setBreedSel([]);
    setEvt({title:"교배 성공!", emoji:"🥚", result:(mutated?"✨ 돌연변이 발생! ":"")+"["+GRADES[grade].name+"] 등급 알이 태어났어요! 속성: "+elems.map(e=>ELEMENTS[e].emoji+ELEMENTS[e].name).join(", ")+" · "+rand(2,3)+"일 뒤 부화 예정."});
  }

  /* ----- AI 투기장 ----- */
  const DIFFS = {
    easy:   { name:"쉬움",   grades:["common","common","common"], mult:1,    reward:200, color:"#22c55e" },
    normal: { name:"중급",   grades:["common","rare","common"],   mult:1,    reward:400, color:"#3b82f6" },
    hard:   { name:"어려움", grades:["rare","rare","epic"],        mult:1.1,  reward:700, color:"#a855f7" },
    legend: { name:"전설",   grades:["epic","epic","legendary"],   mult:1.25, reward:1200, color:"#eab308" },
    myth:   { name:"신화",   grades:["legendary","legendary","legendary"], mult:1.5, reward:2500, color:"#ef4444" },
  };
  const [arenaDiff, setArenaDiff] = useState("easy");
  const [arenaSel, setArenaSel] = useState([]);
  const [battle, setBattle] = useState(null); // {left,right,leftName,rightName,leftIsAI,rightIsAI, ctx}

  function toggleArena(d){
    setArenaSel(s=> s.find(x=>x===d.id) ? s.filter(x=>x!==d.id) : (s.length<3 ? [...s, d.id] : s));
  }
  function startArena(){
    if(arenaSel.length!==3){ notify("출전할 드래곤 3마리를 선택하세요."); return; }
    const my = arenaSel.map(id=>dragons.find(d=>d.id===id));
    const cfg = DIFFS[arenaDiff];
    const enemies = cfg.grades.map(g=>randomDragon(g, cfg.mult));
    setBattle({ left:my, right:enemies, leftName:"내 팀", rightName:"AI ("+cfg.name+")",
      leftIsAI:false, rightIsAI:true, ctx:{type:"arena", diff:arenaDiff} });
  }

  /* ----- 친선전 (Pass & Play) ----- */
  const [fStage, setFStage] = useState("lobby"); // lobby -> p1pick -> p2pick -> battle
  const [roomCode, setRoomCode] = useState("");
  const [p1Deck, setP1Deck] = useState([]);
  const [p2Deck, setP2Deck] = useState([]);

  function makeLocalRoom(){ setRoomCode(String(rand(1000,9999))); setFStage("p1pick"); setP1Deck([]); setP2Deck([]); }
  function joinLocalRoom(){ setRoomCode("2481"); setFStage("p1pick"); setP1Deck([]); setP2Deck([]); }
  function togglePick(deck,setDeck,d){ setDeck(s=> s.find(x=>x===d.id)?s.filter(x=>x!==d.id):(s.length<3?[...s,d.id]:s)); }

  /* ----- 친선전 온라인 (다른 기기, Trystero P2P) ----- */
  const [friendlyMode, setFriendlyMode] = useState("local"); // 'local' | 'online'
  const [netStage, setNetStage] = useState("idle"); // idle -> pick -> waiting -> battle
  const [netRoomCode, setNetRoomCode] = useState("");
  const [netRoomInput, setNetRoomInput] = useState("");
  const [netMySide, setNetMySide] = useState(null); // 'left' | 'right'
  const [netPeerConnected, setNetPeerConnected] = useState(false);
  const [netMyDeck, setNetMyDeck] = useState([]); // 내 dragons 중 선택한 id들
  const [netMyDeckObjs, setNetMyDeckObjs] = useState(null); // 전송한 시점의 덱 객체 스냅샷
  const [netPeerDeckObjs, setNetPeerDeckObjs] = useState(null); // 상대에게서 받은 덱 객체
  const [incomingAttack, setIncomingAttack] = useState(null);
  const netRef = useRef({});

  function netSetupRoom(code, mySide){
    setNetRoomCode(code); setNetMySide(mySide); setNetStage("pick");
    setNetMyDeck([]); setNetMyDeckObjs(null); setNetPeerDeckObjs(null); setNetPeerConnected(false);
    ensureTrystero(t=>{
      const room = t.joinRoom({appId:"yunny-dragon-nursery-v1"}, "ynd-"+code);
      // 이 버전의 trystero는 makeAction이 [send, onMessage] 튜플이 아니라
      // {send, onMessage(getter/setter)} 객체 하나를 반환하고,
      // onPeerJoin/onPeerLeave도 함수 호출이 아니라 프로퍼티 대입으로 등록한다.
      const deckAction = room.makeAction("deck");
      const atkAction = room.makeAction("atk");
      netRef.current = {room, sendDeck: deckAction.send, sendAtk: atkAction.send};
      room.onPeerJoin = ()=> setNetPeerConnected(true);
      room.onPeerLeave = ()=> notify("상대방의 연결이 끊겼어요.");
      deckAction.onMessage = deck=> setNetPeerDeckObjs(deck);
      atkAction.onMessage = action=> setIncomingAttack({...action, counter: Date.now()+Math.random()});
    });
  }
  function netHost(){ netSetupRoom(Math.random().toString(36).slice(2,8).toUpperCase(), "left"); }
  function netJoin(){
    const code = netRoomInput.trim().toUpperCase();
    if(!code){ notify("방 코드를 입력하세요."); return; }
    netSetupRoom(code, "right");
  }
  function netLeaveRoom(){
    if(netRef.current.room) netRef.current.room.leave();
    netRef.current = {};
    setNetStage("idle"); setNetRoomCode(""); setNetRoomInput(""); setNetMySide(null);
    setNetPeerConnected(false); setNetMyDeck([]); setNetMyDeckObjs(null); setNetPeerDeckObjs(null);
  }
  function sendMyDeck(){
    if(netMyDeck.length!==3){ notify("드래곤 3마리를 선택하세요."); return; }
    const deckObjs = netMyDeck.map(id=>dragons.find(d=>d.id===id));
    setNetMyDeckObjs(deckObjs);
    netRef.current.sendDeck && netRef.current.sendDeck(deckObjs);
    setNetStage("waiting");
  }
  // 양쪽 덱이 모두 준비되면 자동으로 전투 시작
  useEffect(()=>{
    if(netStage==="waiting" && netPeerDeckObjs && netMyDeckObjs){
      const left = netMySide==="left" ? netMyDeckObjs : netPeerDeckObjs;
      const right = netMySide==="left" ? netPeerDeckObjs : netMyDeckObjs;
      setBattle({ left, right, leftName: netMySide==="left"?"나":"상대", rightName: netMySide==="right"?"나":"상대",
        leftIsAI:false, rightIsAI:false,
        network:{ mySide: netMySide, send: action => netRef.current.sendAtk && netRef.current.sendAtk(action) },
        ctx:{type:"online"} });
      setNetStage("battle");
    }
  }, [netStage, netPeerDeckObjs, netMyDeckObjs]);

  function endBattle(winner){
    const ctx = battle.ctx;
    if(ctx.type==="arena"){
      if(winner==="left"){ const r=DIFFS[ctx.diff].reward; setGold(g=>g+r); setDragons(ds=>ds.map(x=> arenaSel.includes(x.id)?{...x, hp:x.maxHp}:x)); notify("🏆 승리! 보상 "+r+"G 획득!"); }
      else notify("패배했어요... 다시 도전해봐요!");
      setArenaSel([]);
    } else if(ctx.type==="online"){
      notify(winner===netMySide ? "🎉 승리!" : "💥 패배했어요...");
      netLeaveRoom();
    } else {
      notify(winner==="left"?"🎉 1P 승리!":"🎉 2P 승리!");
      setFStage("lobby"); setP1Deck([]); setP2Deck([]);
    }
    setBattle(null);
  }

  const grown = dragons.filter(d=>d.growth>=100);

  /* ============ 렌더 ============ */
  if(battle){
    return (
      <div className="max-w-4xl mx-auto p-3">
        <BattleArena {...battle} onExit={endBattle} incomingAttack={incomingAttack}/>
      </div>
    );
  }

  const TABS = [
    { k:"nursery",  label:"보육원",   emoji:"🏡" },
    { k:"breeding", label:"교배소",   emoji:"🥚" },
    { k:"arena",    label:"AI 투기장", emoji:"⚔️" },
    { k:"friendly", label:"친선전",   emoji:"🤝" },
    { k:"codex",    label:"도감",     emoji:"📖" },
  ];

  return (
    <div className="max-w-5xl mx-auto p-3 text-slate-100">
      {/* 상단바 */}
      <div className="flex items-center justify-between rounded-2xl bg-slate-900/80 border border-slate-700 px-4 py-2 mb-3">
        <div className="font-black text-lg bg-gradient-to-r from-amber-300 to-pink-400 bg-clip-text text-transparent">🐉 드래곤 보육원 & 배틀 RPG</div>
        <div className="flex items-center gap-3 text-sm font-bold">
          <span className="px-3 py-1 rounded-lg bg-amber-500/20 text-amber-300">💰 {gold.toLocaleString()} G</span>
          <span className="px-3 py-1 rounded-lg bg-sky-500/20 text-sky-300">📅 {day}일차</span>
          <span className="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-300">🐲 {dragons.length}마리</span>
          <span className="px-3 py-1 rounded-lg bg-yellow-500/20 text-yellow-300">🌟 비늘 {scales}</span>
          <button onClick={()=>setSaveModal({mode:"export", code: encodeSave({gold,day,dragons,eggs,dex,scales})})}
            className="px-2 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs">💾 내보내기</button>
          <button onClick={()=>setSaveModal({mode:"import", text:""})}
            className="px-2 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs">📥 불러오기</button>
        </div>
      </div>

      {/* 탭 */}
      <div className="grid grid-cols-5 gap-2 mb-4">
        {TABS.map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)}
            className={"py-2 rounded-xl font-bold text-sm transition "+(tab===t.k?"bg-indigo-500 text-white shadow-lg":"bg-slate-800 text-slate-300 hover:bg-slate-700")}>
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      {/* 보육원 */}
      {tab==="nursery" && (
        <div className="fade">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-slate-200">🏡 보육원 · 드래곤 {dragons.length}마리 / 알 {eggs.length}개</h2>
            <button onClick={nextDay}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-400 hover:to-fuchsia-400 font-black text-white shadow-lg">
              🌙 다음 날로 →
            </button>
          </div>
          {eggs.length>0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {eggs.map(e=>(
                <div key={e.id} className="rounded-xl bg-slate-800/70 border border-slate-700 px-3 py-2 text-sm flex items-center gap-2">
                  <span className="text-2xl">🥚</span>
                  <div><GradeBadge grade={e.grade}/><div className="text-[10px] text-slate-400 mt-0.5">부화까지 {e.daysLeft}일</div></div>
                </div>
              ))}
            </div>
          )}
          {/* 각성소 */}
          <div className="rounded-2xl bg-gradient-to-r from-amber-900/30 to-yellow-900/20 border border-amber-500/40 p-3 mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm">
              <span className="font-bold text-amber-300">🌟 각성소</span>
              <span className="text-slate-300"> · 각성의 비늘 <b className="text-yellow-300">{scales}개</b> 보유 · 전설 등급을 비늘 {AWAKEN_COST}개로 각성!</span>
            </div>
            <button onClick={buyScale} disabled={gold<SCALE_PRICE}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 font-black text-slate-900 disabled:opacity-40">
              🌟 각성의 비늘 구매 ({SCALE_PRICE}G)
            </button>
          </div>
          <div className="grid md:grid-cols-3 sm:grid-cols-2 grid-cols-1 gap-3">
            {dragons.map(d=><NurseryCard key={d.id} d={d} onFeed={feed} onClean={clean} onAwaken={awaken} scales={scales}/>)}
          </div>
        </div>
      )}

      {/* 교배소 */}
      {tab==="breeding" && (
        <div className="fade">
          <h2 className="font-bold text-slate-200 mb-1">🥚 교배소</h2>
          <p className="text-xs text-slate-400 mb-3">다 자란(성장도 100) 드래곤 2마리를 선택해 교배하세요. 부모의 속성이 합쳐지고, 확률적으로 돌연변이가 일어나 더 높은 등급의 알이 태어나요! (비용 100G)</p>
          <div className="grid md:grid-cols-3 sm:grid-cols-2 grid-cols-1 gap-3 mb-4">
            {dragons.map(d=>(
              <NurseryCard key={d.id} d={d} selectable selected={breedSel.includes(d.id)} disabled={d.growth<100}
                onSelect={()=>toggleBreed(d)}/>
            ))}
          </div>
          <button onClick={breed} disabled={breedSel.length!==2}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-400 font-black text-white disabled:opacity-40">
            💞 교배하기 ({breedSel.length}/2 선택됨)
          </button>
        </div>
      )}

      {/* AI 투기장 */}
      {tab==="arena" && (
        <div className="fade">
          <h2 className="font-bold text-slate-200 mb-1">⚔️ AI 투기장 (3 vs 3)</h2>
          <p className="text-xs text-slate-400 mb-3">난이도를 고르고 출전할 드래곤 3마리를 선택하세요. 어려울수록 AI가 강하지만 보상도 커요!</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {Object.entries(DIFFS).map(([k,v])=>(
              <button key={k} onClick={()=>setArenaDiff(k)}
                className={"px-4 py-2 rounded-xl font-bold text-sm border-2 transition "+(arenaDiff===k?"text-white":"text-slate-300 border-transparent bg-slate-800")}
                style={arenaDiff===k?{background:v.color+"33", borderColor:v.color, color:v.color}:{}}>
                {v.name} <span className="text-[10px] opacity-80">· {v.reward}G</span>
              </button>
            ))}
          </div>
          <div className="grid md:grid-cols-3 sm:grid-cols-2 grid-cols-1 gap-3 mb-4">
            {dragons.map(d=>(
              <NurseryCard key={d.id} d={d} selectable selected={arenaSel.includes(d.id)}
                disabled={!arenaSel.includes(d.id)&&arenaSel.length>=3}
                onSelect={()=>toggleArena(d)}/>
            ))}
          </div>
          <button onClick={startArena} disabled={arenaSel.length!==3}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-400 font-black text-white disabled:opacity-40">
            🔥 전투 시작! ({arenaSel.length}/3 출전)
          </button>
        </div>
      )}

      {/* 친선전 */}
      {tab==="friendly" && (
        <div className="fade">
          <h2 className="font-bold text-slate-200 mb-1">🤝 친선전</h2>
          <div className="flex gap-2 mb-4">
            <button onClick={()=>setFriendlyMode("local")}
              className={"flex-1 py-2 rounded-xl font-bold text-sm "+(friendlyMode==="local"?"bg-indigo-500 text-white":"bg-slate-800 text-slate-300 hover:bg-slate-700")}>
              📱 로컬 2인 (한 기기)
            </button>
            <button onClick={()=>setFriendlyMode("online")}
              className={"flex-1 py-2 rounded-xl font-bold text-sm "+(friendlyMode==="online"?"bg-indigo-500 text-white":"bg-slate-800 text-slate-300 hover:bg-slate-700")}>
              🌐 온라인 대전 (다른 기기)
            </button>
          </div>

          {friendlyMode==="local" && (
            <div>
              {fStage==="lobby" && (
                <div className="mt-2 grid sm:grid-cols-2 gap-4">
                  <div className="rounded-2xl bg-slate-800/70 border border-slate-700 p-5 text-center">
                    <div className="text-4xl mb-2">🏠</div><div className="font-bold mb-2">방 만들기</div>
                    <p className="text-xs text-slate-400 mb-3">새 방을 만들고 친구에게 코드를 알려주세요.</p>
                    <button onClick={makeLocalRoom} className="w-full py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 font-bold">방 만들기</button>
                  </div>
                  <div className="rounded-2xl bg-slate-800/70 border border-slate-700 p-5 text-center">
                    <div className="text-4xl mb-2">🔑</div><div className="font-bold mb-2">참여하기</div>
                    <p className="text-xs text-slate-400 mb-3">한 기기에서 번갈아 조작하는 로컬 대전이에요.</p>
                    <button onClick={joinLocalRoom} className="w-full py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 font-bold text-slate-900">참여하기</button>
                  </div>
                </div>
              )}
              {(fStage==="p1pick"||fStage==="p2pick") && (
                <div className="mt-3">
                  <div className="rounded-xl bg-slate-800/70 border border-slate-700 px-4 py-2 mb-3 text-sm flex items-center justify-between">
                    <span>🔑 방 코드: <b className="text-amber-300">{roomCode}</b></span>
                    <span className="font-bold text-emerald-300">{fStage==="p1pick"?"1P":"2P"} 덱 구성 중...</span>
                  </div>
                  <p className="text-xs text-slate-400 mb-3">{fStage==="p1pick"?"1P":"2P"}가 사용할 드래곤 3마리를 선택하세요. (기기를 넘겨가며 진행)</p>
                  <div className="grid md:grid-cols-3 sm:grid-cols-2 grid-cols-1 gap-3 mb-4">
                    {dragons.map(d=>{
                      const deck = fStage==="p1pick"?p1Deck:p2Deck;
                      return <NurseryCard key={d.id} d={d} selectable selected={deck.includes(d.id)}
                        disabled={!deck.includes(d.id)&&deck.length>=3}
                        onSelect={()=> fStage==="p1pick"? togglePick(p1Deck,setP1Deck,d) : togglePick(p2Deck,setP2Deck,d)}/>;
                    })}
                  </div>
                  {fStage==="p1pick" ? (
                    <button onClick={()=>setFStage("p2pick")} disabled={p1Deck.length!==3}
                      className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 font-black text-slate-900 disabled:opacity-40">
                      1P 완료 → 2P에게 넘기기 ({p1Deck.length}/3)
                    </button>
                  ) : (
                    <button onClick={()=>{
                        const l=p1Deck.map(id=>dragons.find(d=>d.id===id));
                        const r=p2Deck.map(id=>dragons.find(d=>d.id===id));
                        setBattle({ left:l, right:r, leftName:"1P", rightName:"2P", leftIsAI:false, rightIsAI:false, ctx:{type:"friendly"} });
                        setFStage("battle");
                      }} disabled={p2Deck.length!==3}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 font-black text-white disabled:opacity-40">
                      ⚔️ 대전 시작! ({p2Deck.length}/3)
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {friendlyMode==="online" && (
            <div>
              <p className="text-xs text-slate-400 mb-3">서버 없이 브라우저끼리 직접 연결돼요. 한쪽이 방을 만들고, 생성된 코드를 카톡 등으로 상대에게 알려주면 서로 다른 기기에서 실시간으로 싸울 수 있어요.</p>
              {netStage==="idle" && (
                <div className="mt-2 grid sm:grid-cols-2 gap-4">
                  <div className="rounded-2xl bg-slate-800/70 border border-slate-700 p-5 text-center">
                    <div className="text-4xl mb-2">🌐</div><div className="font-bold mb-2">방 만들기</div>
                    <p className="text-xs text-slate-400 mb-3">새 방을 만들고 생성된 코드를 상대에게 알려주세요.</p>
                    <button onClick={netHost} className="w-full py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 font-bold">방 만들기</button>
                  </div>
                  <div className="rounded-2xl bg-slate-800/70 border border-slate-700 p-5 text-center">
                    <div className="text-4xl mb-2">🔑</div><div className="font-bold mb-2">참여하기</div>
                    <input value={netRoomInput} onChange={e=>setNetRoomInput(e.target.value)} placeholder="방 코드 입력"
                      className="w-full mb-2 px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-center font-bold tracking-widest text-slate-100 uppercase"/>
                    <button onClick={netJoin} className="w-full py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 font-bold text-slate-900">참여하기</button>
                  </div>
                </div>
              )}
              {netStage==="pick" && (
                <div className="mt-3">
                  <div className="rounded-xl bg-slate-800/70 border border-slate-700 px-4 py-2 mb-3 text-sm flex items-center justify-between">
                    <span>🔑 방 코드: <b className="text-amber-300">{netRoomCode}</b></span>
                    <span className={"font-bold "+(netPeerConnected?"text-emerald-300":"text-amber-300 animate-pulse")}>
                      {netPeerConnected ? "✅ 상대 연결됨" : "⏳ 상대 연결 대기 중..."}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mb-3">사용할 드래곤 3마리를 선택하고 덱을 보내세요.</p>
                  <div className="grid md:grid-cols-3 sm:grid-cols-2 grid-cols-1 gap-3 mb-4">
                    {dragons.map(d=>(
                      <NurseryCard key={d.id} d={d} selectable selected={netMyDeck.includes(d.id)}
                        disabled={!netMyDeck.includes(d.id)&&netMyDeck.length>=3}
                        onSelect={()=> setNetMyDeck(s=> s.includes(d.id)? s.filter(x=>x!==d.id) : (s.length<3?[...s,d.id]:s))}/>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={netLeaveRoom} className="px-4 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 font-bold text-sm">나가기</button>
                    <button onClick={sendMyDeck} disabled={netMyDeck.length!==3}
                      className="flex-1 py-3 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 font-black text-white disabled:opacity-40">
                      📤 덱 보내기 ({netMyDeck.length}/3)
                    </button>
                  </div>
                </div>
              )}
              {netStage==="waiting" && (
                <div className="mt-6 text-center text-slate-300">
                  <div className="text-4xl mb-3 animate-pulse">⏳</div>
                  <p>상대방이 덱을 고르는 중이에요... 잠시만 기다려주세요.</p>
                  <button onClick={netLeaveRoom} className="mt-4 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm">취소하고 나가기</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 도감 */}
      {tab==="codex" && (()=>{
        const discovered = Object.keys(dex).map(key=>{ const elements=key.split("+"); return {key, elements, grade:gradeByCount(elements.length), name:dragonNameFor(elements)}; });
        const multi = discovered.filter(e=>e.elements.length>=2)
          .sort((a,b)=> (({legendary:0,epic:1,rare:2,common:3})[a.grade]-({legendary:0,epic:1,rare:2,common:3})[b.grade]) || a.name.localeCompare(b.name));
        return (
          <div className="fade">
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-bold text-slate-200">📖 드래곤 도감</h2>
              <span className="text-sm font-bold text-amber-300">발견 {Object.keys(dex).length}종</span>
            </div>
            <p className="text-xs text-slate-400 mb-4">드래곤의 <b className="text-slate-200">이름은 속성 조합으로 고정</b>돼요. 같은 속성이면 언제나 같은 이름·같은 종족이에요. 새 조합을 교배로 발견해 도감을 채워보세요!</p>

            <h3 className="font-bold text-slate-300 text-sm mb-2">🔰 기본 속성 종족 (일반)</h3>
            <div className="grid md:grid-cols-3 sm:grid-cols-2 grid-cols-1 gap-3 mb-5">
              {ELEM_KEYS.map(k=>{
                const disc = !!dex[k];
                return (
                  <div key={k} className="rounded-xl p-3 border bg-slate-900/70" style={{borderColor:ELEMENTS[k].color+"55", opacity:disc?1:0.55}}>
                    <div className="flex items-center gap-2">
                      <div className="text-2xl">{disc?"🦎":"🔒"}</div>
                      <div className="flex-1">
                        <div className="font-bold text-slate-100">{disc?ELEM_LORE[k].base:"??? (미발견)"}</div>
                        <ElemChips elements={[k]}/>
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-2">🎬 {ATTACK_FX[k].name}</div>
                  </div>
                );
              })}
            </div>

            <h3 className="font-bold text-slate-300 text-sm mb-2">🧬 발견한 교배종 ({multi.length})</h3>
            {multi.length===0 ? (
              <div className="rounded-xl bg-slate-800/60 border border-slate-700 p-5 text-center text-sm text-slate-400">
                아직 교배로 발견한 종족이 없어요. 🥚 교배소에서 서로 다른 속성의 드래곤을 교배해보세요!
              </div>
            ) : (
              <div className="grid md:grid-cols-3 sm:grid-cols-2 grid-cols-1 gap-3">
                {multi.map(e=>(
                  <div key={e.key} className="rounded-xl p-3 border bg-slate-900/70" style={{borderColor:GRADES[e.grade].color+"66"}}>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="text-2xl">{DRAGON_EMOJI[e.grade]}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2"><span className="font-bold text-slate-100">{e.name}</span><GradeBadge grade={e.grade}/></div>
                        <ElemChips elements={e.elements}/>
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-400">❤️ 기본 HP ~{GRADES[e.grade].hp} · ⚔️ 기본 공격 ~{GRADES[e.grade].atk}</div>
                    {e.grade==="legendary" && (
                      <div className="mt-2 text-[11px] border-t border-slate-700 pt-2">
                        <div className="text-amber-300 font-bold mb-1">🌟 속성별 전설 궁극기</div>
                        {e.elements.map(el=>(
                          <div key={el} className="flex items-center gap-1" style={{color:ELEMENTS[el].color}}>
                            <span>{ELEMENTS[el].emoji}</span><span className="font-semibold">{ultNameFor(el)}</span>
                          </div>
                        ))}
                        <div className="text-amber-200 font-bold mt-2 mb-1">✨ 각성기 (각성 시 사용 가능)</div>
                        {e.elements.map(el=>(
                          <div key={el} className="text-slate-300"><span style={{color:ELEMENTS[el].color}}>{AWAKEN_SKILLS[el].emoji} {AWAKEN_SKILLS[el].name}</span> — {AWAKEN_SKILLS[el].desc}</div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* 토스트 */}
      {toast && <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-xl bg-slate-100 text-slate-900 font-bold shadow-2xl fade">{toast}</div>}

      {/* 이벤트 모달 */}
      {evt && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="rounded-2xl bg-slate-900 border-2 border-indigo-500/60 max-w-md w-full p-6 fade shadow-2xl">
            <div className="text-center text-5xl mb-2">{evt.emoji}</div>
            <div className="text-center text-xl font-black mb-3 text-indigo-300">{evt.title}</div>
            {evt.desc && <p className="text-center text-sm text-slate-300 mb-4">{evt.desc}</p>}
            {evt.result && <p className="text-center text-sm text-emerald-300 mb-4 font-semibold">{evt.result}</p>}
            {evt.choices ? (
              <div className="flex flex-col gap-2">
                {evt.choices.map((c,i)=>(
                  <button key={i} onClick={()=>{ const msg=c.run(); setEvt({title:evt.title, emoji:evt.emoji, result:msg}); }}
                    className="w-full py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 font-bold text-white">{c.label}</button>
                ))}
              </div>
            ) : (
              <button onClick={()=>setEvt(null)} className="w-full py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 font-bold text-white">확인</button>
            )}
          </div>
        </div>
      )}

      {/* 저장 내보내기 / 불러오기 모달 */}
      {saveModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="rounded-2xl bg-slate-900 border-2 border-indigo-500/60 max-w-lg w-full p-6 fade shadow-2xl">
            {saveModal.mode==="export" ? (
              <div>
                <div className="text-center text-3xl mb-2">💾</div>
                <div className="text-center text-lg font-black mb-3 text-indigo-300">저장 코드 내보내기</div>
                <p className="text-xs text-slate-400 mb-2">이 코드를 복사해서 다른 기기의 "📥 불러오기"에 붙여넣으면 진행 상황이 그대로 옮겨져요. (이 기기에는 이미 자동 저장되어 있어요)</p>
                <textarea readOnly value={saveModal.code} onFocus={e=>e.target.select()}
                  className="w-full h-32 p-2 rounded-lg bg-slate-950 border border-slate-700 text-[11px] text-slate-300 font-mono mb-3"/>
                <div className="flex gap-2">
                  <button onClick={()=>{
                      const ta=document.createElement("textarea"); ta.value=saveModal.code;
                      document.body.appendChild(ta); ta.select();
                      try{ document.execCommand("copy"); notify("📋 복사했어요!"); }catch(e){ notify("복사에 실패했어요. 직접 선택해서 복사해주세요."); }
                      document.body.removeChild(ta);
                    }} className="flex-1 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 font-bold text-white">📋 복사하기</button>
                  <button onClick={()=>setSaveModal(null)} className="px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 font-bold text-white">닫기</button>
                </div>
              </div>
            ) : (
              <div>
                <div className="text-center text-3xl mb-2">📥</div>
                <div className="text-center text-lg font-black mb-3 text-indigo-300">저장 코드 불러오기</div>
                <p className="text-xs text-slate-400 mb-2">다른 기기에서 "💾 내보내기"로 받은 코드를 붙여넣으세요. 현재 진행 상황을 덮어써요.</p>
                <textarea value={saveModal.text} onChange={e=>setSaveModal(m=>({...m, text:e.target.value}))}
                  placeholder="여기에 저장 코드를 붙여넣으세요"
                  className="w-full h-32 p-2 rounded-lg bg-slate-950 border border-slate-700 text-[11px] text-slate-300 font-mono mb-3"/>
                <div className="flex gap-2">
                  <button onClick={()=>{
                      try{
                        const obj = decodeSave(saveModal.text);
                        const ids=[...obj.dragons.map(d=>d.id), ...obj.eggs.map(e=>e.id)];
                        if(ids.length) _id = Math.max(_id, Math.max(...ids)+1);
                        setGold(obj.gold); setDay(obj.day); setDragons(obj.dragons); setEggs(obj.eggs);
                        if(obj.dex) setDex(obj.dex);
                        setScales(obj.scales||0);
                        setSaveModal(null); notify("✅ 불러오기 완료!");
                      }catch(e){ notify("코드가 올바르지 않아요. 다시 확인해주세요."); }
                    }} className="flex-1 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 font-bold text-white">불러오기</button>
                  <button onClick={()=>setSaveModal(null)} className="px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 font-bold text-white">닫기</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<Game/>);
</script>
</body>
</html>'''


def dragon_nursery_page():
    st.title("🐉 드래곤 보육원 & 배틀 RPG")
    st.caption("React + Tailwind로 만든 게임 · 먹이 주고 → 교배하고 → 3v3로 싸워보자! (보육원/교배소/AI 투기장/친선전)")
    components.html(DRAGON_GAME_HTML, height=940, scrolling=True)


# ==========================================
# 8. 메인 네비게이션 진입 게이트웨이
# ==========================================
st.set_page_config(
    page_title="종합 게임 허브 스트림릿",
    page_icon="🌟",
    layout="wide"
)

home = st.Page(home_page, title="홈 화면", icon="🌟")
game = st.Page(game_page, title="업다운 게임", icon="🎮")
board = st.Page(board_page, title="뱀사다리 말판 게임", icon="🎲")
quoridor = st.Page(quoridor_page, title="쿼리도 두뇌 게임", icon="🧱")
rpg = st.Page(rpg_page, title="성장형 RPG 게임", icon="⚔️")
multiplayer_rpg = st.Page(multiplayer_rpg_page, title="1대1 멀티 RPG 배틀", icon="⚔️")
dragon = st.Page(dragon_nursery_page, title="드래곤 보육원 & 배틀", icon="🐉")
wordle = st.Page(wordle_page, title="워들 퍼즐 게임", icon="🔠")
adventure = st.Page(adventure_page, title="마법학교 신입생의 하루", icon="🗺️")
typing_game = st.Page(typing_game_page, title="스피드 타자 워리어", icon="⌨️")

pg = st.navigation([home, game, board, quoridor, rpg, multiplayer_rpg, dragon, wordle, adventure, typing_game])
pg.run()

